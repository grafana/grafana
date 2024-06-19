package gmsclient

import (
	"context"
	"encoding/json"
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
	snapshot *cloudmigration.InitializeSnapshotResponse
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
		Items: make([]cloudmigration.MigrateDataResponseItem, len(request.Items)),
	}

	for i, v := range request.Items {
		result.Items[i] = cloudmigration.MigrateDataResponseItem{
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

func (c *memoryClientImpl) InitializeSnapshot(context.Context, cloudmigration.CloudMigrationSession) (*cloudmigration.InitializeSnapshotResponse, error) {
	c.snapshot = &cloudmigration.InitializeSnapshotResponse{
		EncryptionKey:  util.GenerateShortUID(),
		GMSSnapshotUID: util.GenerateShortUID(),
		UploadURL:      "localhost:3000",
	}

	return c.snapshot, nil
}

func (c *memoryClientImpl) GetSnapshotStatus(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (*cloudmigration.CloudMigrationSnapshot, error) {
	// just fake an entire response
	gmsSnapshot := cloudmigration.CloudMigrationSnapshot{
		Status:         cloudmigration.SnapshotStatusFinished,
		GMSSnapshotUID: util.GenerateShortUID(),
		Result:         []byte{},
		Finished:       time.Now(),
	}

	result := []cloudmigration.MigrateDataResponseItem{
		{
			Type:   cloudmigration.DashboardDataType,
			RefID:  util.GenerateShortUID(),
			Status: cloudmigration.ItemStatusOK,
		},
		{
			Type:   cloudmigration.DatasourceDataType,
			RefID:  util.GenerateShortUID(),
			Status: cloudmigration.ItemStatusError,
			Error:  "fake error",
		},
		{
			Type:   cloudmigration.FolderDataType,
			RefID:  util.GenerateShortUID(),
			Status: cloudmigration.ItemStatusOK,
		},
	}

	b, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}
	gmsSnapshot.Result = b

	return &gmsSnapshot, nil
}
