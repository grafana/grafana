package pluginproxy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/url"
	"strings"
	"text/template"
	"time"

	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/tsdb"
	es "github.com/grafana/grafana/pkg/tsdb/elasticsearch/client"
)

// InterpolateString accepts template data and return a string with substitutions
func InterpolateString(text string, data templateData) (string, error) {
	t, err := template.New("content").Parse(text)
	if err != nil {
		return "", fmt.Errorf("could not parse template %s", text)
	}

	var contentBuf bytes.Buffer
	err = t.Execute(&contentBuf, data)
	if err != nil {
		return "", fmt.Errorf("failed to execute template %s", text)
	}

	return contentBuf.String(), nil
}

// InterpolateURL accepts template data and return a string with substitutions
func InterpolateURL(anURL *url.URL, route *plugins.AppPluginRoute, orgID int64, appID string) (*url.URL, error) {
	query := m.GetPluginSettingByIdQuery{OrgId: orgID, PluginId: appID}
	result, err := url.Parse(anURL.String())
	if query.Result != nil {
		if len(query.Result.JsonData) > 0 {
			data := templateData{
				JsonData: query.Result.JsonData,
			}
			interpolatedResult, err := InterpolateString(anURL.String(), data)
			if err == nil {
				result, err = url.Parse(interpolatedResult)
				if err != nil {
					return nil, fmt.Errorf("error parsing plugin route url %v", err)
				}
			}
		}
	}

	return result, err
}

// enforceRequestedEsIndex take a DataSourceProxy as argument and return an error if the requested index by the client is not the one configured in the datasource.
func enforceRequestedEsIndex(proxy *DataSourceProxy) error {
	nowFrom := time.Now()
	from := time.Date(nowFrom.Year(), nowFrom.Month(), nowFrom.Day(), nowFrom.Hour(), nowFrom.Minute(), 0, 0, time.UTC)

	nowTo := nowFrom.Add(time.Duration(5) * time.Minute) // Add the 5minutes
	to := time.Date(nowTo.Year(), nowTo.Month(), nowTo.Day(), nowTo.Hour(), nowTo.Minute(), 0, 0, time.UTC)

	fromStr := fmt.Sprintf("%d", from.UnixNano()/int64(time.Millisecond))
	toStr := fmt.Sprintf("%d", to.UnixNano()/int64(time.Millisecond))
	timeRange := tsdb.NewTimeRange(fromStr, toStr)

	indexInterval := proxy.ds.JsonData.Get("interval").MustString()
	ip, err := es.NewIndexPattern(indexInterval, proxy.ds.Database)
	if err != nil {
		return err
	}
	indices, err := ip.GetIndices(timeRange)
	if err != nil {
		return err
	}

	buffer, err := ioutil.ReadAll(proxy.ctx.Req.Request.Body)
	if err != nil {
		return err
	}
	proxy.ctx.Req.Request.Body = ioutil.NopCloser(bytes.NewBuffer(buffer))
	jsonPart := strings.Split(string(buffer), "\n")[0]
	var requestIndex struct {
		Names interface{} `json:"index"`
	}
	err = json.Unmarshal([]byte(jsonPart), &requestIndex)
	if err != nil {
		return fmt.Errorf("unable to unmarshall JSON request body : %s", err.Error())
	}
	var found = false
	switch requestIndex.Names.(type) {
	case string:
		for _, indice := range indices {
			if requestIndex.Names.(string) == indice {
				found = true
				break
			}
		}
	case []interface{}:
		for _, requestedDb := range requestIndex.Names.([]interface{}) {
			for _, indice := range indices {
				if requestedDb.(string) == indice {
					found = true
					break
				}
			}
			if found {
				break
			}
		}
	default:
		return fmt.Errorf("unable to get type of the index: %+v", requestIndex.Names)
	}
	if !found {
		return fmt.Errorf("the index requested '%v' is not present in the datasources", requestIndex.Names)
	}
	return nil
}
