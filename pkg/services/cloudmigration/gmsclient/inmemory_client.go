package gmsclient

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"

	cryptoRand "crypto/rand"

	"github.com/google/uuid"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"golang.org/x/crypto/nacl/box"
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

func (c *memoryClientImpl) StartSnapshot(_ context.Context, sess cloudmigration.CloudMigrationSession) (*cloudmigration.StartSnapshotResponse, error) {
	publicKey, _, err := box.GenerateKey(cryptoRand.Reader)
	if err != nil {
		return nil, fmt.Errorf("nacl: generating public and private key: %w", err)
	}

	snapshotUid := uuid.NewString()

	metadataBuffer, err := json.Marshal(struct {
		SnapshotID string `json:"snapshotID"`
		StackID    string `json:"stackID"`
		Slug       string `json:"slug"`
	}{
		SnapshotID: snapshotUid,
		StackID:    fmt.Sprintf("%d", sess.StackID),
		Slug:       sess.Slug,
	})

	if err != nil {
		return nil, fmt.Errorf("marshalling metadata: %w", err)
	}

	c.snapshot = &cloudmigration.StartSnapshotResponse{
		EncryptionKey:        publicKey[:],
		SnapshotID:           snapshotUid,
		MaxItemsPerPartition: 10,
		Algo:                 "nacl",
		Metadata:             metadataBuffer,
	}

	return c.snapshot, nil
}

func (c *memoryClientImpl) GetSnapshotStatus(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot, offset int) (*cloudmigration.GetSnapshotStatusResponse, error) {
	gmsResp := &cloudmigration.GetSnapshotStatusResponse{
		State: cloudmigration.SnapshotStateFinished,
		Results: []cloudmigration.CloudMigrationResource{
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
		},
	}

	return gmsResp, nil
}

func (c *memoryClientImpl) CreatePresignedUploadUrl(ctx context.Context, sess cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	return "http://localhost:3000", nil
}

func (c *memoryClientImpl) ReportEvent(context.Context, cloudmigration.CloudMigrationSession, EventRequestDTO) {
}
