package cmsclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// NewCMSClient returns an implementation of Client that queries CloudMigrationService
func NewCMSClient(domain string) Client {
	return &cmsClientImpl{
		domain: domain,
		log:    log.New(logPrefix),
	}
}

type cmsClientImpl struct {
	domain string
	log    *log.ConcreteLogger
}

func (c *cmsClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigration) error {
	logger := c.log.FromContext(ctx)

	path := fmt.Sprintf("https://cms-%s.%s/cloud-migrations/api/v1/validate-key", cm.ClusterSlug, c.domain)

	// validation is an empty POST to CMS with the authorization header included
	req, err := http.NewRequest("POST", path, bytes.NewReader(nil))
	if err != nil {
		logger.Error("error creating http request for token validation", "err", err.Error())
		return fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", cm.StackID, cm.AuthToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		logger.Error("error sending http request for token validation", "err", err.Error())
		return fmt.Errorf("http request error: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("closing request body", "err", err.Error())
		}
	}()

	if resp.StatusCode != 200 {
		var errResp map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&errResp); err != nil {
			logger.Error("decoding error response", "err", err.Error())
		} else {
			return fmt.Errorf("token validation failure: %v", errResp)
		}
	}

	return nil
}

func (c *cmsClientImpl) MigrateData(ctx context.Context, cm cloudmigration.CloudMigration, request cloudmigration.MigrateDataRequestDTO) (*cloudmigration.MigrateDataResponseDTO, error) {
	logger := c.log.FromContext(ctx)

	path := fmt.Sprintf("https://cms-%s.%s/cloud-migrations/api/v1/migrate-data", cm.ClusterSlug, c.domain)

	body, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	// Send the request to cms with the associated auth token
	req, err := http.NewRequest(http.MethodPost, path, bytes.NewReader(body))
	if err != nil {
		c.log.Error("error creating http request for cloud migration run", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", cm.StackID, cm.AuthToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request for cloud migration run", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response for cloud migration run", "statusCode", resp.StatusCode)
		return nil, fmt.Errorf("http request error: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("closing request body: %w", err)
		}
	}()

	var result cloudmigration.MigrateDataResponseDTO
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		logger.Error("unmarshalling response body: %w", err)
		return nil, fmt.Errorf("unmarshalling migration run response: %w", err)
	}

	return &result, nil
}
