package azuremonitor

import (
	"bytes"
	"time"

	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util/errutil"
	"github.com/opentracing/opentracing-go"
	"golang.org/x/net/context/ctxhttp"
)

// AzureResourceGraphDatasource calls the Azure Resource Graph API's
type AzureResourceGraphDatasource struct {
	proxy serviceProxy
}

// AzureResourceGraphQuery is the query request that is built from the saved values for
// from the UI
type AzureResourceGraphQuery struct {
	RefID             string
	ResultFormat      string
	URL               string
	JSON              json.RawMessage
	InterpolatedQuery string
	TimeRange         backend.TimeRange
}

const argAPIVersion = "2021-03-01"
const argQueryProviderName = "/providers/Microsoft.ResourceGraph/resources"

func (e *AzureResourceGraphDatasource) resourceRequest(rw http.ResponseWriter, req *http.Request, cli *http.Client) {
	e.proxy.Do(rw, req, cli)
}

// executeTimeSeriesQuery does the following:
// 1. builds the AzureMonitor url and querystring for each query
// 2. executes each query by calling the Azure Monitor API
// 3. parses the responses for each query into data frames
func (e *AzureResourceGraphDatasource) executeTimeSeriesQuery(ctx context.Context, originalQueries []backend.DataQuery, dsInfo datasourceInfo, client *http.Client, url string) (*backend.QueryDataResponse, error) {
	result := &backend.QueryDataResponse{
		Responses: map[string]backend.DataResponse{},
	}

	queries, err := e.buildQueries(originalQueries, dsInfo)
	if err != nil {
		return nil, err
	}

	for _, query := range queries {
		result.Responses[query.RefID] = e.executeQuery(ctx, query, dsInfo, client, url)
	}

	return result, nil
}

func (e *AzureResourceGraphDatasource) buildQueries(queries []backend.DataQuery, dsInfo datasourceInfo) ([]*AzureResourceGraphQuery, error) {
	var azureResourceGraphQueries []*AzureResourceGraphQuery

	for _, query := range queries {
		queryJSONModel := argJSONQuery{}
		err := json.Unmarshal(query.JSON, &queryJSONModel)
		if err != nil {
			return nil, fmt.Errorf("failed to decode the Azure Resource Graph query object from JSON: %w", err)
		}

		azureResourceGraphTarget := queryJSONModel.AzureResourceGraph
		azlog.Debug("AzureResourceGraph", "target", azureResourceGraphTarget)

		resultFormat := azureResourceGraphTarget.ResultFormat
		if resultFormat == "" {
			resultFormat = "table"
		}

		interpolatedQuery, err := KqlInterpolate(query, dsInfo, azureResourceGraphTarget.Query)

		if err != nil {
			return nil, err
		}

		azureResourceGraphQueries = append(azureResourceGraphQueries, &AzureResourceGraphQuery{
			RefID:             query.RefID,
			ResultFormat:      resultFormat,
			JSON:              query.JSON,
			InterpolatedQuery: interpolatedQuery,
			TimeRange:         query.TimeRange,
		})
	}

	return azureResourceGraphQueries, nil
}

func (e *AzureResourceGraphDatasource) executeQuery(ctx context.Context, query *AzureResourceGraphQuery, dsInfo datasourceInfo, client *http.Client, dsURL string) backend.DataResponse {
	dataResponse := backend.DataResponse{}

	params := url.Values{}
	params.Add("api-version", argAPIVersion)

	dataResponseErrorWithExecuted := func(err error) backend.DataResponse {
		dataResponse = backend.DataResponse{Error: err}
		frames := data.Frames{
			&data.Frame{
				RefID: query.RefID,
				Meta: &data.FrameMeta{
					ExecutedQueryString: query.InterpolatedQuery,
				},
			},
		}
		dataResponse.Frames = frames
		return dataResponse
	}

	model, err := simplejson.NewJson(query.JSON)
	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	reqBody, err := json.Marshal(map[string]interface{}{
		"subscriptions": model.Get("subscriptions").MustStringArray(),
		"query":         query.InterpolatedQuery,
		"options":       map[string]string{"resultFormat": "table"},
	})

	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	req, err := e.createRequest(ctx, dsInfo, reqBody, dsURL)

	if err != nil {
		dataResponse.Error = err
		return dataResponse
	}

	req.URL.Path = path.Join(req.URL.Path, argQueryProviderName)
	req.URL.RawQuery = params.Encode()

	span, ctx := opentracing.StartSpanFromContext(ctx, "azure resource graph query")
	span.SetTag("interpolated_query", query.InterpolatedQuery)
	span.SetTag("from", query.TimeRange.From.UnixNano()/int64(time.Millisecond))
	span.SetTag("until", query.TimeRange.To.UnixNano()/int64(time.Millisecond))
	span.SetTag("datasource_id", dsInfo.DatasourceID)
	span.SetTag("org_id", dsInfo.OrgID)

	defer span.Finish()

	if err := opentracing.GlobalTracer().Inject(
		span.Context(),
		opentracing.HTTPHeaders,
		opentracing.HTTPHeadersCarrier(req.Header)); err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	azlog.Debug("AzureResourceGraph", "Request ApiURL", req.URL.String())
	res, err := ctxhttp.Do(ctx, client, req)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	argResponse, err := e.unmarshalResponse(res)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	frame, err := ResponseTableToFrame(&argResponse.Data)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	azurePortalUrl, err := getAzurePortalUrl(dsInfo.Cloud)
	if err != nil {
		return dataResponseErrorWithExecuted(err)
	}

	url := azurePortalUrl + "/#blade/HubsExtension/ArgQueryBlade/query/" + url.PathEscape(query.InterpolatedQuery)
	frameWithLink := addConfigData(*frame, url)
	if frameWithLink.Meta == nil {
		frameWithLink.Meta = &data.FrameMeta{}
	}
	frameWithLink.Meta.ExecutedQueryString = req.URL.RawQuery

	dataResponse.Frames = data.Frames{&frameWithLink}
	return dataResponse
}

func addConfigData(frame data.Frame, dl string) data.Frame {
	for i := range frame.Fields {
		if frame.Fields[i].Config == nil {
			frame.Fields[i].Config = &data.FieldConfig{}
		}
		deepLink := data.DataLink{
			Title:       "View in Azure Portal",
			TargetBlank: true,
			URL:         dl,
		}
		frame.Fields[i].Config.Links = append(frame.Fields[i].Config.Links, deepLink)
	}
	return frame
}

func (e *AzureResourceGraphDatasource) createRequest(ctx context.Context, dsInfo datasourceInfo, reqBody []byte, url string) (*http.Request, error) {
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewBuffer(reqBody))
	if err != nil {
		azlog.Debug("Failed to create request", "error", err)
		return nil, errutil.Wrap("failed to create request", err)
	}
	req.URL.Path = "/"
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", setting.BuildVersion))

	return req, nil
}

func (e *AzureResourceGraphDatasource) unmarshalResponse(res *http.Response) (AzureResourceGraphResponse, error) {
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return AzureResourceGraphResponse{}, err
	}
	defer func() {
		if err := res.Body.Close(); err != nil {
			azlog.Warn("Failed to close response body", "err", err)
		}
	}()

	if res.StatusCode/100 != 2 {
		azlog.Debug("Request failed", "status", res.Status, "body", string(body))
		return AzureResourceGraphResponse{}, fmt.Errorf("request failed, status: %s, body: %s", res.Status, string(body))
	}

	var data AzureResourceGraphResponse
	d := json.NewDecoder(bytes.NewReader(body))
	d.UseNumber()
	err = d.Decode(&data)
	if err != nil {
		azlog.Debug("Failed to unmarshal azure resource graph response", "error", err, "status", res.Status, "body", string(body))
		return AzureResourceGraphResponse{}, err
	}

	return data, nil
}

func getAzurePortalUrl(azureCloud string) (string, error) {
	switch azureCloud {
	case setting.AzurePublic:
		return "https://portal.azure.com", nil
	case setting.AzureChina:
		return "https://portal.azure.cn", nil
	case setting.AzureUSGovernment:
		return "https://portal.azure.us", nil
	case setting.AzureGermany:
		return "https://portal.microsoftazure.de", nil
	default:
		return "", fmt.Errorf("the cloud is not supported")
	}
}
