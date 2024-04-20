package cmsclient

import (
	"context"
	"math/rand"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// NewInMemoryClient returns an implementation of Client that returns canned responses
func NewInMemoryClient() Client {
	return &memoryClientImpl{}
}

type memoryClientImpl struct{}

func (c *memoryClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigration) error {
	// return ErrMigrationNotDeleted
	return nil
}

func (c *memoryClientImpl) MigrateData(
	ctx context.Context,
	cm cloudmigration.CloudMigration,
	request cloudmigration.MigrateDataRequestDTO,
) (*cloudmigration.MigrateDataResponseDTO, error) {
	//return nil, ErrMigrationNotDeleted

	result := cloudmigration.MigrateDataResponseDTO{
		Items: make([]cloudmigration.MigrateDataResponseItemDTO, len(request.Items)),
	}

	for i, v := range request.Items {
		result.Items[i] = cloudmigration.MigrateDataResponseItemDTO{
			Type:   v.Type,
			RefID:  v.RefID,
			Status: cloudmigration.ItemStatusOK,
		}
	}

	// simulate flakiness on one random item
	i := rand.Intn(len(result.Items))
	failedItem := result.Items[i]
	failedItem.Status, failedItem.Error = cloudmigration.ItemStatusError, "simulated random error"
	result.Items[i] = failedItem

	return &result, nil
}
