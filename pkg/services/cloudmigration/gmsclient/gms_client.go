package gmsclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// NewGMSClient returns an implementation of Client that queries GrafanaMigrationService
func NewGMSClient(domain string, minPollingPeriod time.Duration) Client {
	if minPollingPeriod < time.Second {
		minPollingPeriod = time.Second // ensure we can't spam GMS
	}
	return &gmsClientImpl{
		domain:                    domain,
		log:                       log.New(logPrefix),
		minGetStatusPollingPeriod: minPollingPeriod,
	}
}

type gmsClientImpl struct {
	domain                    string
	minGetStatusPollingPeriod time.Duration
	log                       *log.ConcreteLogger

	getStatusMux         sync.Mutex
	getStatusLastQueried time.Time
}

func (c *gmsClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	logger := c.log.FromContext(ctx)

	// TODO update service url to gms
	path := fmt.Sprintf("https://cms-%s.%s/cloud-migrations/api/v1/validate-key", cm.ClusterSlug, c.domain)

	// validation is an empty POST to GMS with the authorization header included
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

func (c *gmsClientImpl) MigrateData(ctx context.Context, cm cloudmigration.CloudMigrationSession, request cloudmigration.MigrateDataRequest) (*cloudmigration.MigrateDataResponse, error) {
	logger := c.log.FromContext(ctx)

	// TODO update service url to gms
	path := fmt.Sprintf("https://cms-%s.%s/cloud-migrations/api/v1/migrate-data", cm.ClusterSlug, c.domain)

	reqDTO := convertRequestToDTO(request)
	body, err := json.Marshal(reqDTO)
	if err != nil {
		return nil, fmt.Errorf("error marshaling request: %w", err)
	}

	// Send the request to GMS with the associated auth token
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

	var respDTO MigrateDataResponseDTO
	if err := json.NewDecoder(resp.Body).Decode(&respDTO); err != nil {
		logger.Error("unmarshalling response body: %w", err)
		return nil, fmt.Errorf("unmarshalling migration run response: %w", err)
	}

	result := convertResponseFromDTO(respDTO)
	return &result, nil
}

func (c *gmsClientImpl) StartSnapshot(ctx context.Context, session cloudmigration.CloudMigrationSession) (*cloudmigration.StartSnapshotResponse, error) {
	logger := c.log.FromContext(ctx)

	path := fmt.Sprintf("https://cms-%s.%s/cloud-migrations/api/v1/start-snapshot", session.ClusterSlug, c.domain)

	// Send the request to cms with the associated auth token
	req, err := http.NewRequest(http.MethodPost, path, nil)
	if err != nil {
		c.log.Error("error creating http request to start snapshot", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request to start snapshot", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response to start snapshot", "statusCode", resp.StatusCode)
		return nil, fmt.Errorf("http request error: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("closing request body: %w", err)
		}
	}()

	var result cloudmigration.StartSnapshotResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		logger.Error("unmarshalling response body: %w", err)
		return nil, fmt.Errorf("unmarshalling start snapshot response: %w", err)
	}

	return &result, nil
}

func (c *gmsClientImpl) GetSnapshotStatus(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (*cloudmigration.GetSnapshotStatusResponse, error) {
	c.getStatusMux.Lock()
	defer c.getStatusMux.Unlock()
	logger := c.log.FromContext(ctx)

	// Ensure we can't send requests more frequently than supported
	if !c.getStatusLastQueried.IsZero() && time.Since(c.getStatusLastQueried) < c.minGetStatusPollingPeriod {
		logger.Debug("skipping query to Grafana Migration Service because this request was made too soon after the previous one")
		return &cloudmigration.GetSnapshotStatusResponse{
			State: cloudmigration.SnapshotStateUnknown,
		}, nil
	}

	path := fmt.Sprintf("https://cms-%s.%s/cloud-migrations/api/v1/snapshots/%s/status", session.ClusterSlug, c.domain, snapshot.GMSSnapshotUID)

	// Send the request to gms with the associated auth token
	req, err := http.NewRequest(http.MethodGet, path, nil)
	if err != nil {
		c.log.Error("error creating http request to get snapshot status", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %d:%s", session.StackID, session.AuthToken))

	client := &http.Client{}
	c.getStatusLastQueried = time.Now()
	resp, err := client.Do(req)
	if err != nil {
		c.log.Error("error sending http request to get snapshot status", "err", err.Error())
		return nil, fmt.Errorf("http request error: %w", err)
	} else if resp.StatusCode >= 400 {
		c.log.Error("received error response to get snapshot status", "statusCode", resp.StatusCode)
		return nil, fmt.Errorf("http request error: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			logger.Error("closing request body: %w", err)
		}
	}()

	var result cloudmigration.GetSnapshotStatusResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		logger.Error("unmarshalling response body: %w", err)
		return nil, fmt.Errorf("unmarshalling get snapshot status response: %w", err)
	}

	return &result, nil
}

func convertRequestToDTO(request cloudmigration.MigrateDataRequest) MigrateDataRequestDTO {
	items := make([]MigrateDataRequestItemDTO, len(request.Items))
	for i := 0; i < len(request.Items); i++ {
		item := request.Items[i]
		items[i] = MigrateDataRequestItemDTO{
			Type:  MigrateDataType(item.Type),
			RefID: item.RefID,
			Name:  item.Name,
			Data:  item.Data,
		}
	}
	r := MigrateDataRequestDTO{
		Items: items,
	}
	return r
}

func convertResponseFromDTO(result MigrateDataResponseDTO) cloudmigration.MigrateDataResponse {
	items := make([]cloudmigration.CloudMigrationResource, len(result.Items))
	for i := 0; i < len(result.Items); i++ {
		item := result.Items[i]
		items[i] = cloudmigration.CloudMigrationResource{
			Type:   cloudmigration.MigrateDataType(item.Type),
			RefID:  item.RefID,
			Status: cloudmigration.ItemStatus(item.Status),
			Error:  item.Error,
		}
	}
	return cloudmigration.MigrateDataResponse{
		RunUID: result.RunUID,
		Items:  items,
	}
}
