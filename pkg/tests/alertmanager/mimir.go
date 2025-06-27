package alertmanager

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/e2e"
)

const (
	mimirImage = "grafana/mimir:r348-017076d8"

	mimirBinary   = "/bin/mimir"
	mimirHTTPPort = 8080
)

type MimirService struct {
	*e2e.HTTPService
}

func NewMimirService(name string) *MimirService {
	flags := map[string]string{
		"-target":                                                  "alertmanager",
		"-server.http-listen-port":                                 "8080",
		"-server.grpc-listen-port":                                 "9095",
		"-alertmanager.web.external-url":                           "http://localhost:8080/alertmanager",
		"-alertmanager-storage.backend":                            "filesystem",
		"-alertmanager-storage.filesystem.dir":                     "/tmp/mimir/alertmanager",
		"-alertmanager.grafana-alertmanager-compatibility-enabled": "true",
	}

	return &MimirService{
		HTTPService: e2e.NewHTTPService(
			name,
			mimirImage,
			e2e.NewCommandWithoutEntrypoint(mimirBinary, e2e.BuildArgs(flags)...),
			e2e.NewHTTPReadinessProbe(mimirHTTPPort, "/ready", 200, 299),
			mimirHTTPPort,
		),
	}
}

type MimirClient struct {
	*http.Client
	baseURL  *url.URL
	tenantID string
}

func NewMimirClient(mimirURL, tenantID string) (*MimirClient, error) {
	pu, err := url.Parse(mimirURL)
	if err != nil {
		return nil, err
	}
	return &MimirClient{
		Client:   &http.Client{Timeout: 30 * time.Second},
		baseURL:  pu,
		tenantID: tenantID,
	}, nil
}

func (mc *MimirClient) GetGrafanaAlertmanagerConfig(ctx context.Context) (map[string]any, error) {
	u := mc.baseURL.ResolveReference(&url.URL{Path: "/api/v1/grafana/config"})
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Scope-OrgID", mc.tenantID)

	resp, err := mc.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	switch resp.StatusCode {
	case http.StatusOK:
		var cfg map[string]any
		if err := json.Unmarshal(body, &cfg); err != nil {
			return nil, err
		}
		return cfg, nil

	case http.StatusNotFound:
		return map[string]any{}, nil

	default:
		return nil, fmt.Errorf("GET %s: %d %s", u, resp.StatusCode, string(body))
	}
}

func (mc *MimirClient) SetGrafanaAlertmanagerConfig(ctx context.Context, cfg map[string]any) error {
	u := mc.baseURL.ResolveReference(&url.URL{Path: "/alertmanager/api/v1/alerts"})

	payload, err := json.Marshal(cfg)
	if err != nil {
		return err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, u.String(), bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Scope-OrgID", mc.tenantID)

	resp, err := mc.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode == http.StatusOK {
		return nil
	}
	body, _ := io.ReadAll(resp.Body)

	return fmt.Errorf("POST %s: %d %s", u, resp.StatusCode, string(body))
}
