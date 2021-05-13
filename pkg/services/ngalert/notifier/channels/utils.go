package channels

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/util"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/common/model"
)

const (
	FooterIconURL      = "https://grafana.com/assets/img/fav32.png"
	ColorAlertFiring   = "#D63232"
	ColorAlertResolved = "#36a64f"
)

func getAlertStatusColor(status model.AlertStatus) string {
	if status == model.AlertFiring {
		return ColorAlertFiring
	}
	return ColorAlertResolved
}

func getTitleFromTemplateData(data *template.Data) string {
	title := "[" + data.Status
	if data.Status == string(model.AlertFiring) {
		title += fmt.Sprintf(":%d", len(data.Alerts.Firing()))
	}
	title += "] " + strings.Join(data.GroupLabels.SortedPairs().Values(), " ") + " "
	if len(data.CommonLabels) > len(data.GroupLabels) {
		title += "(" + strings.Join(data.CommonLabels.Remove(data.GroupLabels.Names()).Values(), " ") + ")"
	}
	return title
}

type httpCfg struct {
	body     []byte
	user     string
	password string
}

// sendHTTPRequest sends an HTTP request.
// Stubbable by tests.
var sendHTTPRequest = func(ctx context.Context, url *url.URL, cfg httpCfg, logger log.Logger) ([]byte, error) {
	var reader io.Reader
	if len(cfg.body) > 0 {
		reader = bytes.NewReader(cfg.body)
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url.String(), reader)
	if err != nil {
		return nil, fmt.Errorf("failed to create HTTP request: %w", err)
	}
	if cfg.user != "" && cfg.password != "" {
		request.Header.Set("Authorization", util.GetBasicAuthHeader(cfg.user, cfg.password))
	}

	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("User-Agent", "Grafana")
	netTransport := &http.Transport{
		TLSClientConfig: &tls.Config{
			Renegotiation: tls.RenegotiateFreelyAsClient,
		},
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}
	netClient := &http.Client{
		Timeout:   time.Second * 30,
		Transport: netTransport,
	}
	resp, err := netClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Warn("Failed to close response body", "err", err)
		}
	}()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	if resp.StatusCode/100 != 2 {
		logger.Warn("HTTP request failed", "url", request.URL.String(), "statusCode", resp.Status, "body",
			string(respBody))
		return nil, fmt.Errorf("failed to send HTTP request - status code %d", resp.StatusCode)
	}

	logger.Debug("Sending HTTP request succeeded", "url", request.URL.String(), "statusCode", resp.Status)
	return respBody, nil
}
