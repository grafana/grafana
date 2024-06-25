package gmsclient

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// NewGMSClient returns an implementation of Client that queries GrafanaMigrationService
func NewGMSClient(domain string) Client {
	return &gmsClientImpl{
		domain: domain,
		log:    log.New(logPrefix),
	}
}

type gmsClientImpl struct {
	domain string
	log    *log.ConcreteLogger
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

func (c *gmsClientImpl) InitializeSnapshot(context.Context, cloudmigration.CloudMigrationSession) (*cloudmigration.InitializeSnapshotResponse, error) {
	panic("not implemented")
}

func (c *gmsClientImpl) GetSnapshotStatus(context.Context, cloudmigration.CloudMigrationSession, cloudmigration.CloudMigrationSnapshot) (*cloudmigration.CloudMigrationSnapshot, error) {
	panic("not implemented")
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
