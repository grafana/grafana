package gmsclient

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/setting"
)

// NewGMSClient returns an implementation of Client that queries GrafanaMigrationService
func NewGMSClient(cfg *setting.Cfg, httpClient *http.Client) (Client, error) {
	if cfg.CloudMigration.GMSDomain == "" {
		return nil, fmt.Errorf("missing GMS domain")
	}
	return &gmsClientImpl{
		cfg:        cfg,
		log:        log.New(logPrefix),
		httpClient: httpClient,
	}, nil
}

type gmsClientImpl struct {
	cfg        *setting.Cfg
	log        *log.ConcreteLogger
	httpClient *http.Client

	getStatusMux         sync.Mutex
	getStatusLastQueried time.Time
}

func (c *gmsClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigrationSession) (err error) {
	// TODO: there is a lot of boilerplate code in these methods, we should consolidate them when we have a gardening period
	path, err := c.buildURL(cm.ClusterSlug, "/api/v1/validate-key")
	if err != nil {
		return err
	}

	ctx, cancel := context.WithTimeout(ctx, c.cfg.CloudMigration.GMSValidateKeyTimeout)
	defer cancel()

	// validation is an empty POST to GMS with the authorization header included
	req, err := http.NewRequestWithContext(ctx, "POST", path, bytes.NewReader(nil))
	if err != nil {
		c.log.Error("error creating http request for token validation", "err", err.Error())
		return cloudmigration.ErrTokenRequestError.Errorf("create http request error")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", cm.StackID, cm.AuthToken))

	resp, err := c.httpClient.Do(req)
	if err != nil {
		c.log.Error("error sending http request for token validation", "err", err.Error())
		return cloudmigration.ErrTokenRequestError.Errorf("send http request error")
	}
	defer func() {
		if closeErr := resp.Body.Close(); closeErr != nil {
			c.log.Error("error closing the request body", "err", err.Error())
			err = errors.Join(err, cloudmigration.ErrTokenRequestError.Errorf("closing response body"))
		}
	}()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		if gmsErr := c.handleGMSErrors(body); gmsErr != nil {
			return gmsErr
		}
		return cloudmigration.ErrTokenValidationFailure.Errorf("token validation failure")
	}

	return nil
}

func (c *gmsClientImpl) StartSnapshot(ctx context.Context, session cloudmigration.CloudMigrationSession) (out *cloudmigration.StartSnapshotResponse, err error) {
	path, err := c.buildURL(session.ClusterSlug, "/api/v1/start-snapshot")
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, c.cfg.CloudMigration.GMSStartSnapshotTimeout)
	defer cancel()

	// Send the request to cms with the associated auth token
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, path, nil)
	if err != nil {
		c.log.Error("error creating http request to start snapshot", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	resp, err := c.httpClient.Do(req)
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

	path, err := c.buildURL(session.ClusterSlug, fmt.Sprintf("/api/v1/snapshots/%s/status?offset=%d", snapshot.GMSSnapshotUID, offset))
	if err != nil {
		c.log.Error("error parsing snapshot status url", "err", err.Error())
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, c.cfg.CloudMigration.GMSGetSnapshotStatusTimeout)
	defer cancel()

	// Send the request to gms with the associated auth token
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, path, nil)
	if err != nil {
		c.log.Error("error creating http request to get snapshot status", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	c.getStatusLastQueried = time.Now()
	resp, err := c.httpClient.Do(req)
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
	path, err := c.buildURL(session.ClusterSlug, fmt.Sprintf("/api/v1/snapshots/%s/create-upload-url", snapshot.GMSSnapshotUID))
	if err != nil {
		c.log.Error("error parsing upload url", "err", err.Error())
		return "", err
	}

	ctx, cancel := context.WithTimeout(ctx, c.cfg.CloudMigration.GMSCreateUploadUrlTimeout)
	defer cancel()

	// Send the request to gms with the associated auth token
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, path, nil)
	if err != nil {
		c.log.Error("error creating http request to create upload url", "err", err.Error())
		return "", fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	resp, err := c.httpClient.Do(req)
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

	ctx, cancel := context.WithTimeout(ctx, c.cfg.CloudMigration.GMSReportEventTimeout)
	defer cancel()

	path, err := c.buildURL(session.ClusterSlug, "/api/v1/events")
	if err != nil {
		c.log.Error("parsing events url", "err", err.Error())
		return
	}

	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(event); err != nil {
		c.log.Error("encoding event", "err", err.Error())
		return
	}
	// Send the request to gms with the associated auth token
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, path, &buf)
	if err != nil {
		c.log.Error("error creating http request to report event", "err", err.Error())
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	resp, err := c.httpClient.Do(req)
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

func (c *gmsClientImpl) buildURL(clusterSlug, path string) (string, error) {
	domain := c.cfg.CloudMigration.GMSDomain
	baseURL := fmt.Sprintf("https://cms-%s.%s/cloud-migrations", clusterSlug, domain)

	// Override the host if we are configuring it with a scheme prefix.
	if strings.HasPrefix(domain, "http://") || strings.HasPrefix(domain, "https://") {
		baseURL = domain
	}

	parsed, err := url.Parse(baseURL + path)
	if err != nil {
		return "", fmt.Errorf("building url: %w", err)
	}

	return parsed.String(), nil
}

// handleGMSErrors parses the error message from GMS and translates it to an appropriate error message
// use ErrTokenValidationFailure for any errors which are not specifically handled
func (c *gmsClientImpl) handleGMSErrors(responseBody []byte) error {
	var apiError GMSAPIError
	if err := json.Unmarshal(responseBody, &apiError); err != nil {
		return cloudmigration.ErrTokenValidationFailure.Errorf("token validation failure")
	}

	if strings.Contains(apiError.Message, GMSErrorMessageInstanceUnreachable) {
		return cloudmigration.ErrInstanceUnreachable.Errorf("instance unreachable")
	} else if strings.Contains(apiError.Message, GMSErrorMessageInstanceCheckingError) {
		return cloudmigration.ErrInstanceRequestError.Errorf("instance checking error")
	} else if strings.Contains(apiError.Message, GMSErrorMessageInstanceFetching) {
		return cloudmigration.ErrInstanceRequestError.Errorf("fetching instance")
	}

	return cloudmigration.ErrTokenValidationFailure.Errorf("token validation failure")
}
