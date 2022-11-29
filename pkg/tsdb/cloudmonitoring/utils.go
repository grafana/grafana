package cloudmonitoring

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/tsdb/intervalv2"
)

func addInterval(period string, field *data.Field) error {
	period = strings.TrimPrefix(period, "+")
	p, err := intervalv2.ParseIntervalStringToTimeDuration(period)
	if err != nil {
		return err
	}
	if err == nil {
		if field.Config != nil {
			field.Config.Interval = float64(p.Milliseconds())
		} else {
			field.SetConfig(&data.FieldConfig{
				Interval: float64(p.Milliseconds()),
			})
		}
	}
	return nil
}

func toString(v interface{}) string {
	if v == nil {
		return ""
	}
	return v.(string)
}

func createRequest(logger log.Logger, dsInfo *datasourceInfo, proxyPass string, body io.Reader) (*http.Request, error) {
	u, err := url.Parse(dsInfo.url)
	if err != nil {
		return nil, err
	}
	u.Path = path.Join(u.Path, "render")

	method := http.MethodGet
	if body != nil {
		method = http.MethodPost
	}
	req, err := http.NewRequest(method, dsInfo.services[cloudMonitor].url, body)
	if err != nil {
		logger.Error("Failed to create request", "error", err)
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.URL.Path = proxyPass

	return req, nil
}
