package gmsclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/setting"
)

// NewGMSClient returns an implementation of Client that queries GrafanaMigrationService
func NewGMSClient(cfg *setting.Cfg) (Client, error) {
	if cfg.CloudMigration.GMSDomain == "" {
		return nil, fmt.Errorf("missing GMS domain")
	}
	return &gmsClientImpl{
		cfg: cfg,
		log: log.New(logPrefix),
	}, nil
}

type gmsClientImpl struct {
	cfg *setting.Cfg
	log *log.ConcreteLogger

	getStatusMux         sync.Mutex
	getStatusLastQueried time.Time
}

func (c *gmsClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigrationSession) (err error) {
	// TODO: there is a lot of boilerplate code in these methods, we should consolidate them when we have a gardening period
	path := fmt.Sprintf("%s/api/v1/validate-key", c.buildBasePath(cm.ClusterSlug))

	// validation is an empty POST to GMS with the authorization header included
	req, err := http.NewRequest("POST", path, bytes.NewReader(nil))
	if err != nil {
		c.log.Error("error creating http request for token validation", "err", err.Error())
		return fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", cm.StackID, cm.AuthToken))

	client := &http.Client{
		Timeout: c.cfg.CloudMigration.GMSValidateKeyTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request for token validation", "err", err.Error())
		return fmt.Errorf("http request error: %w", err)
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing response body: %w", closeErr))
		}
	}()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("token validation failure: %v", string(body))
	}

	return nil
}

func (c *gmsClientImpl) StartSnapshot(ctx context.Context, session cloudmigration.CloudMigrationSession) (out *cloudmigration.StartSnapshotResponse, err error) {
	path := fmt.Sprintf("%s/api/v1/start-snapshot", c.buildBasePath(session.ClusterSlug))

	// Send the request to cms with the associated auth token
	req, err := http.NewRequest(http.MethodPost, path, nil)
	if err != nil {
		c.log.Error("error creating http request to start snapshot", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	client := &http.Client{
		Timeout: c.cfg.CloudMigration.GMSStartSnapshotTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request to start snapshot", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response for start snapshot", "statusCode", resp.StatusCode)
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("reading response body: %w", err)
		}
		return nil, fmt.Errorf("http request error: body=%s", string(body))
	}

	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			err = errors.Join(err, fmt.Errorf("closing response body: %w", closeErr))
		}
	}()

	var result cloudmigration.StartSnapshotResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("unmarshalling start snapshot response: %w", err)
	}

	return &result, nil
}

func (c *gmsClientImpl) GetSnapshotStatus(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot, offset int) (*cloudmigration.GetSnapshotStatusResponse, error) {
	c.getStatusMux.Lock()
	defer c.getStatusMux.Unlock()

	path := fmt.Sprintf("%s/api/v1/snapshots/%s/status?offset=%d", c.buildBasePath(session.ClusterSlug), snapshot.GMSSnapshotUID, offset)

	// Send the request to gms with the associated auth token
	req, err := http.NewRequest(http.MethodGet, path, nil)
	if err != nil {
		c.log.Error("error creating http request to get snapshot status", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	client := &http.Client{
		Timeout: c.cfg.CloudMigration.GMSGetSnapshotStatusTimeout,
	}
	c.getStatusLastQueried = time.Now()
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request to get snapshot status", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response for get snapshot status", "statusCode", resp.StatusCode)
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, fmt.Errorf("reading response body: %w", err)
		}
		return nil, fmt.Errorf("http request error: body=%s", string(body))
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.log.Error("closing request body", "err", err.Error())
		}
	}()

	var result cloudmigration.GetSnapshotStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.log.Error("unmarshalling response body", "err", err.Error())
		return nil, fmt.Errorf("unmarshalling get snapshot status response: %w", err)
	}

	return &result, nil
}

func (c *gmsClientImpl) CreatePresignedUploadUrl(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	path := fmt.Sprintf("%s/api/v1/snapshots/%s/create-upload-url", c.buildBasePath(session.ClusterSlug), snapshot.GMSSnapshotUID)

	// Send the request to gms with the associated auth token
	req, err := http.NewRequest(http.MethodPost, path, nil)
	if err != nil {
		c.log.Error("error creating http request to create upload url", "err", err.Error())
		return "", fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	client := &http.Client{
		Timeout: c.cfg.CloudMigration.GMSCreateUploadUrlTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request to create an upload url", "err", err.Error())
		return "", fmt.Errorf("http request error: %w", err)
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response to create an upload url", "statusCode", resp.StatusCode)
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			return "", fmt.Errorf("reading response body: %w", err)
		}
		return "", fmt.Errorf("http request error: body=%s", string(body))
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.log.Error("closing request body", "err", err.Error())
		}
	}()

	var result CreateSnapshotUploadUrlResponseDTO
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		c.log.Error("unmarshalling response body", "err", err.Error())
		return "", fmt.Errorf("unmarshalling create upload url response: %w", err)
	}

	return result.UploadUrl, nil
}

func (c *gmsClientImpl) ReportEvent(ctx context.Context, session cloudmigration.CloudMigrationSession, event EventRequestDTO) {
	if event.LocalID == "" || event.Event == "" {
		return
	}

	path := fmt.Sprintf("%s/api/v1/events", c.buildBasePath(session.ClusterSlug))

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(event); err != nil {
		c.log.Error("encoding event", "err", err.Error())
		return
	}
	// Send the request to gms with the associated auth token
	req, err := http.NewRequest(http.MethodPost, path, &buf)
	if err != nil {
		c.log.Error("error creating http request to report event", "err", err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	client := &http.Client{
		Timeout: c.cfg.CloudMigration.GMSReportEventTimeout,
	}
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request for report event", "err", err.Error())
		return
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response for report event", "type", event.Event, "statusCode", resp.StatusCode)
		body, err := io.ReadAll(resp.Body)
		if err != nil {
			c.log.Error("reading request body", "err", err.Error())
			return
		}
		c.log.Error("http request error", "body", string(body))
		return
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			c.log.Error("closing request body", "err", err.Error())
		}
	}()
}

func (c *gmsClientImpl) buildBasePath(clusterSlug string) string {
	domain := c.cfg.CloudMigration.GMSDomain
	if strings.HasPrefix(domain, "http://") || strings.HasPrefix(domain, "https://") {
		return domain
	}
	return fmt.Sprintf("https://cms-%s.%s/cloud-migrations", clusterSlug, domain)
}
