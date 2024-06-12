package fake

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/gcom"
)

var fixedDate = time.Date(2024, 6, 5, 17, 30, 40, 0, time.UTC)

// FakeServiceImpl fake implementation of cloudmigration.Service for testing purposes
type FakeServiceImpl struct {
	ReturnError bool
}

var _ cloudmigration.Service = (*FakeServiceImpl)(nil)

func (m FakeServiceImpl) GetToken(_ context.Context) (gcom.TokenView, error) {
	if m.ReturnError {
		return gcom.TokenView{}, fmt.Errorf("mock error")
	}
	return gcom.TokenView{ID: "mock_id", DisplayName: "mock_name"}, nil
}

func (m FakeServiceImpl) CreateToken(_ context.Context) (cloudmigration.CreateAccessTokenResponse, error) {
	if m.ReturnError {
		return cloudmigration.CreateAccessTokenResponse{}, fmt.Errorf("mock error")
	}
	return cloudmigration.CreateAccessTokenResponse{Token: "mock_token"}, nil
}

func (m FakeServiceImpl) ValidateToken(ctx context.Context, migration cloudmigration.CloudMigrationSession) error {
	panic("implement me")
}

func (m FakeServiceImpl) DeleteToken(_ context.Context, _ string) error {
	if m.ReturnError {
		return fmt.Errorf("mock error")
	}
	return nil
}

func (m FakeServiceImpl) CreateMigration(_ context.Context, _ cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSessionResponse{
		UID:     "fake_uid",
		Slug:    "fake_stack",
		Created: fixedDate,
		Updated: fixedDate,
	}, nil
}

func (m FakeServiceImpl) GetMigration(_ context.Context, _ string) (*cloudmigration.CloudMigrationSession, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSession{UID: "fake"}, nil
}

func (m FakeServiceImpl) DeleteMigration(_ context.Context, _ string) (*cloudmigration.CloudMigrationSession, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSession{UID: "fake"}, nil
}

func (m FakeServiceImpl) UpdateMigration(ctx context.Context, uid string, request cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	panic("implement me")
}

func (m FakeServiceImpl) GetMigrationList(_ context.Context) (*cloudmigration.CloudMigrationSessionListResponse, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSessionListResponse{
		Sessions: []cloudmigration.CloudMigrationSessionResponse{
			{UID: "mock_uid_1", Slug: "mock_stack_1", Created: fixedDate, Updated: fixedDate},
			{UID: "mock_uid_2", Slug: "mock_stack_2", Created: fixedDate, Updated: fixedDate},
		},
	}, nil
}

func (m FakeServiceImpl) RunMigration(_ context.Context, _ string) (*cloudmigration.MigrateSnapshotResponseDTO, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	r := fakeMigrateDataResponseDTO()
	return &r, nil
}

func fakeMigrateDataResponseDTO() cloudmigration.MigrateSnapshotResponseDTO {
	return cloudmigration.MigrateSnapshotResponseDTO{
		RunUID: "fake_uid",
		Items: []cloudmigration.MigrateSnapshotResponseItemDTO{
			{Type: "type", RefID: "make_refid", Status: "ok", Error: "none"},
		},
	}
}

func (m FakeServiceImpl) CreateMigrationRun(ctx context.Context, run cloudmigration.Snapshot) (string, error) {
	panic("implement me")
}

func (m FakeServiceImpl) GetMigrationStatus(_ context.Context, _ string) (*cloudmigration.Snapshot, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	result, err := json.Marshal(fakeMigrateDataResponseDTO())
	if err != nil {
		return nil, err
	}
	return &cloudmigration.Snapshot{
		ID:         0,
		UID:        "fake_uid",
		SessionUID: "fake_mig_uid",
		Result:     result,
		Created:    fixedDate,
		Updated:    fixedDate,
		Finished:   fixedDate,
	}, nil
}

func (m FakeServiceImpl) GetMigrationRunList(_ context.Context, _ string) (*cloudmigration.SnapshotList, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.SnapshotList{
		Runs: []cloudmigration.MigrateSnapshotResponseListDTO{
			{RunUID: "fake_run_uid_1"},
			{RunUID: "fake_run_uid_2"},
		},
	}, nil
}
