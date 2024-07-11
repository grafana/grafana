package gmsclient

import (
	"context"
	"math/rand"
	"time"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/util"
)

// NewInMemoryClient returns an implementation of Client that returns canned responses
func NewInMemoryClient() Client {
	return &memoryClientImpl{}
}

type memoryClientImpl struct {
	snapshot *cloudmigration.StartSnapshotResponse
}

func (c *memoryClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	return nil
}

func (c *memoryClientImpl) MigrateData(
	ctx context.Context,
	cm cloudmigration.CloudMigrationSession,
	request cloudmigration.MigrateDataRequest,
) (*cloudmigration.MigrateDataResponse, error) {
	result := cloudmigration.MigrateDataResponse{
		Items: make([]cloudmigration.CloudMigrationResource, len(request.Items)),
	}

	for i, v := range request.Items {
		result.Items[i] = cloudmigration.CloudMigrationResource{
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

func (c *memoryClientImpl) StartSnapshot(context.Context, cloudmigration.CloudMigrationSession) (*cloudmigration.StartSnapshotResponse, error) {
	c.snapshot = &cloudmigration.StartSnapshotResponse{
		EncryptionKey: util.GenerateShortUID(),
		SnapshotID:    util.GenerateShortUID(),
		UploadURL:     "localhost:3000",
	}

	return c.snapshot, nil
}

func (c *memoryClientImpl) GetSnapshotStatus(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (*cloudmigration.CloudMigrationSnapshot, error) {
	results := []cloudmigration.CloudMigrationResource{
		{
			Type:   cloudmigration.DashboardDataType,
			RefID:  "dash1",
			Status: cloudmigration.ItemStatusOK,
		},
		{
			Type:   cloudmigration.DatasourceDataType,
			RefID:  "ds1",
			Status: cloudmigration.ItemStatusError,
			Error:  "fake error",
		},
		{
			Type:   cloudmigration.FolderDataType,
			RefID:  "folder1",
			Status: cloudmigration.ItemStatusOK,
		},
	}

	// just fake an entire response
	gmsSnapshot := cloudmigration.CloudMigrationSnapshot{
		Status:         cloudmigration.SnapshotStatusFinished,
		GMSSnapshotUID: "gmssnapshotuid",
		Resources:      results,
		Finished:       time.Now(),
	}

	return &gmsSnapshot, nil
}
