package opentsdb

import (
	"context"
	"net/http"
	"net/url"
	"path"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
)

func HandleSuggestQuery(ctx context.Context, logger log.Logger, dsInfo *datasourceInfo, req *backend.CallResourceRequest, sender backend.CallResourceResponseSender) error {
	u, err := url.Parse(dsInfo.URL)
	if err != nil {
		return err
	}

	reqURL, err := url.Parse(req.URL)
	if err != nil {
		return err
	}

	u.Path = path.Join(u.Path, reqURL.Path)
	u.RawQuery = reqURL.RawQuery
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return err
	}

	res, err := dsInfo.HTTPClient.Do(httpReq)
	if err != nil {
		return err
	}

	defer func() {
		if err := res.Body.Close(); err != nil {
			logger.Error("Failed to close response body", "error", err)
		}
	}()

	body, err := DecodeResponseBody(res, logger)
	if err != nil {
		return err
	}

	return sender.Send(&backend.CallResourceResponse{
		Status: res.StatusCode,
		Headers: map[string][]string{
			"content-type": {"application/json"},
		},
		Body: body,
	})
}
