package fake

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/grafana/grafana/pkg/services/authapi"
	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/user"
)

var fixedDate = time.Date(2024, 6, 5, 17, 30, 40, 0, time.UTC)

// FakeServiceImpl fake implementation of cloudmigration.Service for testing purposes
type FakeServiceImpl struct {
	ReturnError bool
}

var _ cloudmigration.Service = (*FakeServiceImpl)(nil)

func (m FakeServiceImpl) GetToken(_ context.Context) (authapi.TokenView, error) {
	if m.ReturnError {
		return authapi.TokenView{}, fmt.Errorf("mock error")
	}
	return authapi.TokenView{ID: "mock_id", DisplayName: "mock_name"}, nil
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

func (m FakeServiceImpl) CreateSession(_ context.Context, _ *user.SignedInUser, _ cloudmigration.CloudMigrationSessionRequest) (*cloudmigration.CloudMigrationSessionResponse, error) {
	if m.ReturnError {
		return nil, cloudmigration.ErrSessionCreationFailure
	}
	return &cloudmigration.CloudMigrationSessionResponse{
		UID:     "fake_uid",
		Slug:    "fake_stack",
		Created: fixedDate,
		Updated: fixedDate,
	}, nil
}

func (m FakeServiceImpl) GetSession(_ context.Context, _ int64, _ string) (*cloudmigration.CloudMigrationSession, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSession{UID: "fake"}, nil
}

func (m FakeServiceImpl) DeleteSession(_ context.Context, _ int64, _ *user.SignedInUser, _ string) (*cloudmigration.CloudMigrationSession, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSession{UID: "fake"}, nil
}

func (m FakeServiceImpl) GetSessionList(_ context.Context, _ int64) (*cloudmigration.CloudMigrationSessionListResponse, error) {
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

func (m FakeServiceImpl) CreateSnapshot(ctx context.Context, user *user.SignedInUser, sessionUid string) (*cloudmigration.CloudMigrationSnapshot, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	return &cloudmigration.CloudMigrationSnapshot{
		UID:        "fake_uid",
		SessionUID: sessionUid,
		Status:     cloudmigration.SnapshotStatusCreating,
	}, nil
}

func (m FakeServiceImpl) GetSnapshot(ctx context.Context, query cloudmigration.GetSnapshotsQuery) (*cloudmigration.CloudMigrationSnapshot, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}
	cloudMigrationResources := []cloudmigration.CloudMigrationResource{
		{
			Type:       cloudmigration.DashboardDataType,
			RefID:      "123",
			Status:     cloudmigration.ItemStatusPending,
			Name:       "dashboard name",
			ParentName: "dashboard parent name",
		},
		{
			Type:       cloudmigration.DatasourceDataType,
			RefID:      "456",
			Status:     cloudmigration.ItemStatusOK,
			Name:       "datasource name",
			ParentName: "dashboard parent name",
		},
	}

	return &cloudmigration.CloudMigrationSnapshot{
		UID:        "fake_uid",
		SessionUID: "fake_uid",
		Status:     cloudmigration.SnapshotStatusCreating,
		Resources:  cloudMigrationResources,
	}, nil
}

func (m FakeServiceImpl) GetSnapshotList(ctx context.Context, query cloudmigration.ListSnapshotsQuery) ([]cloudmigration.CloudMigrationSnapshot, error) {
	if m.ReturnError {
		return nil, fmt.Errorf("mock error")
	}

	cloudSnapshots := []cloudmigration.CloudMigrationSnapshot{
		{
			UID:        "fake_uid",
			SessionUID: query.SessionUID,
			Status:     cloudmigration.SnapshotStatusCreating,
			Created:    time.Date(2024, 6, 5, 17, 30, 40, 0, time.UTC),
		},
		{
			UID:        "fake_uid",
			SessionUID: query.SessionUID,
			Status:     cloudmigration.SnapshotStatusCreating,
			Created:    time.Date(2024, 6, 5, 18, 30, 40, 0, time.UTC),
		},
	}

	if query.Sort == "latest" {
		sort.Slice(cloudSnapshots, func(first, second int) bool {
			return cloudSnapshots[first].Created.After(cloudSnapshots[second].Created)
		})
	}
	if query.Limit > 0 {
		return cloudSnapshots[0:min(len(cloudSnapshots), query.Limit)], nil
	}
	return cloudSnapshots, nil
}

func (m FakeServiceImpl) UploadSnapshot(ctx context.Context, _ int64, _ *user.SignedInUser, sessionUid string, snapshotUid string) error {
	if m.ReturnError {
		return fmt.Errorf("mock error")
	}
	return nil
}

func (m FakeServiceImpl) CancelSnapshot(ctx context.Context, sessionUid string, snapshotUid string) error {
	if m.ReturnError {
		return fmt.Errorf("mock error")
	}
	return nil
}
