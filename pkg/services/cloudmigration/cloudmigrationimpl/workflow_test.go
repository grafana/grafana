package cloudmigrationimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
	"github.com/grafana/grafana/pkg/services/user"
)

func TestTransitionSessionWorkflow(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	s := setUpServiceTest(t).(*Service)
	sqlStore := s.store.(*sqlStore)

	sess, err := sqlStore.CreateMigrationSession(ctx, cloudmigration.CloudMigrationSession{
		OrgID:     1,
		AuthToken: "token",
		Slug:      "slug",
		StackID:   1,
	})
	require.NoError(t, err)
	require.Equal(t, cloudmigration.SessionWorkflowIdle, sess.Workflow)

	snapshotUID := "snapshot123"
	err = sqlStore.TransitionSessionWorkflow(ctx, 1, sess.UID,
		cloudmigration.SessionWorkflowIdle,
		cloudmigration.SessionWorkflowBuildingSnapshot,
		&snapshotUID,
	)
	require.NoError(t, err)

	updated, err := sqlStore.GetMigrationSessionByUID(ctx, 1, sess.UID)
	require.NoError(t, err)
	require.Equal(t, cloudmigration.SessionWorkflowBuildingSnapshot, updated.Workflow)
	require.Equal(t, snapshotUID, updated.ActiveSnapshotUID)

	err = sqlStore.TransitionSessionWorkflow(ctx, 1, sess.UID,
		cloudmigration.SessionWorkflowIdle,
		cloudmigration.SessionWorkflowUploadingSnapshot,
		&snapshotUID,
	)
	require.Error(t, err)

	var mismatch cloudmigration.SessionWorkflowMismatchError
	require.True(t, errors.As(err, &mismatch))
	require.Equal(t, cloudmigration.SessionWorkflowBuildingSnapshot, mismatch.Workflow)
}

func TestCreateSnapshotReturnsConflictWhenBusy(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	s := setUpServiceTest(t).(*Service)
	sqlStore := s.store.(*sqlStore)

	sess, err := sqlStore.CreateMigrationSession(ctx, cloudmigration.CloudMigrationSession{
		OrgID:     1,
		AuthToken: "token",
		Slug:      "slug",
		StackID:   1,
	})
	require.NoError(t, err)

	active := "busy-snapshot"
	require.NoError(t, sqlStore.TransitionSessionWorkflow(ctx, 1, sess.UID,
		cloudmigration.SessionWorkflowIdle,
		cloudmigration.SessionWorkflowBuildingSnapshot,
		&active,
	))

	_, err = s.CreateSnapshot(ctx, &user.SignedInUser{OrgID: 1}, cloudmigration.CreateSnapshotCommand{
		SessionUID:    sess.UID,
		ResourceTypes: cloudmigration.ResourceTypes{cloudmigration.DashboardDataType: {}},
	})
	require.Error(t, err)

	var conflict cloudmigration.SessionConflictError
	require.True(t, errors.As(err, &conflict))
	require.True(t, conflict.CanForce)
	require.Equal(t, cloudmigration.SessionWorkflowBuildingSnapshot, conflict.Workflow)
}
