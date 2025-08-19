package gmsclient

import (
	"context"
	cryptoRand "crypto/rand"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"golang.org/x/crypto/nacl/box"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

// NewInMemoryClient returns an implementation of Client that returns canned responses
func NewInMemoryClient() Client {
	return &memoryClientImpl{
		mx:           &sync.Mutex{},
		snapshotInfo: make(map[string]cloudmigration.SnapshotState),
	}
}

type memoryClientImpl struct {
	mx           *sync.Mutex
	snapshotInfo map[string]cloudmigration.SnapshotState // snapshotUID -> state
}

func (c *memoryClientImpl) ValidateKey(ctx context.Context, cm cloudmigration.CloudMigrationSession) error {
	return nil
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

	c.mx.Lock()
	c.snapshotInfo[snapshotUid] = cloudmigration.SnapshotStateInitialized
	c.mx.Unlock()

	return &cloudmigration.StartSnapshotResponse{
		GMSPublicKey:         publicKey[:],
		SnapshotID:           snapshotUid,
		MaxItemsPerPartition: 10,
		Algo:                 "nacl",
		Metadata:             metadataBuffer,
	}, nil
}

func (c *memoryClientImpl) GetSnapshotStatus(ctx context.Context, session cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot, offset int) (*cloudmigration.GetSnapshotStatusResponse, error) {
	c.mx.Lock()
	snapshotInfo := c.snapshotInfo[snapshot.UID]
	c.mx.Unlock()

	resources := make([]cloudmigration.CloudMigrationResource, 0, len(snapshot.Resources))
	for _, resource := range snapshot.Resources {
		if snapshotInfo == cloudmigration.SnapshotStateFinished {
			resources = append(resources, cloudmigration.CloudMigrationResource{
				Type:   resource.Type,
				RefID:  resource.RefID,
				Status: cloudmigration.ItemStatusOK,
			})
		} else {
			resources = append(resources, cloudmigration.CloudMigrationResource{
				Type:  resource.Type,
				RefID: resource.RefID,
			})
		}
	}

	gmsResp := &cloudmigration.GetSnapshotStatusResponse{
		State:   snapshotInfo,
		Results: resources,
	}

	c.mx.Lock()
	// Next call, transition to the next state.
	if c.snapshotInfo[snapshot.UID] == cloudmigration.SnapshotStateInitialized {
		c.snapshotInfo[snapshot.UID] = cloudmigration.SnapshotStateProcessing
	} else {
		c.snapshotInfo[snapshot.UID] = cloudmigration.SnapshotStateFinished
	}
	c.mx.Unlock()

	return gmsResp, nil
}

func (c *memoryClientImpl) CreatePresignedUploadUrl(ctx context.Context, sess cloudmigration.CloudMigrationSession, snapshot cloudmigration.CloudMigrationSnapshot) (string, error) {
	return "http://localhost:3000", nil
}

func (c *memoryClientImpl) ReportEvent(context.Context, cloudmigration.CloudMigrationSession, EventRequestDTO) {
}
