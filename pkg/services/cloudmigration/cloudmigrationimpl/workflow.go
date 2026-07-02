package cloudmigrationimpl

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/services/cloudmigration"
)

func sessionConflictFromMismatch(err error, canForce bool) error {
	var mismatch cloudmigration.SessionWorkflowMismatchError
	if !errors.As(err, &mismatch) {
		return err
	}
	return cloudmigration.SessionConflictError{
		Workflow:          mismatch.Workflow,
		ActiveSnapshotUID: mismatch.ActiveSnapshotUID,
		CanForce:          canForce,
	}
}

func (s *Service) transitionSessionWorkflow(
	ctx context.Context,
	orgID int64,
	sessionUID string,
	expected, next cloudmigration.SessionWorkflow,
	activeSnapshotUID *string,
) error {
	if err := s.store.TransitionSessionWorkflow(ctx, orgID, sessionUID, expected, next, activeSnapshotUID); err != nil {
		return err
	}
	return nil
}

func (s *Service) resetSessionWorkflow(ctx context.Context, orgID int64, sessionUID string) error {
	return s.store.ResetSessionWorkflow(ctx, orgID, sessionUID)
}

func (s *Service) ensureSessionIdleForBuild(ctx context.Context, orgID int64, session *cloudmigration.CloudMigrationSession, force bool) error {
	if session.Workflow == "" || session.Workflow == cloudmigration.SessionWorkflowIdle {
		return nil
	}

	if !force {
		return cloudmigration.SessionConflictError{
			Workflow:          session.Workflow,
			ActiveSnapshotUID: session.ActiveSnapshotUID,
			CanForce:          true,
		}
	}

	if err := s.cancelActiveSessionOperation(ctx, orgID, session); err != nil {
		return err
	}

	refreshed, err := s.store.GetMigrationSessionByUID(ctx, orgID, session.UID)
	if err != nil {
		return err
	}
	if refreshed.Workflow != cloudmigration.SessionWorkflowIdle && refreshed.Workflow != "" {
		return cloudmigration.SessionConflictError{
			Workflow:          refreshed.Workflow,
			ActiveSnapshotUID: refreshed.ActiveSnapshotUID,
			CanForce:          true,
		}
	}
	return nil
}

func (s *Service) ensureSessionIdleForUpload(ctx context.Context, orgID int64, session *cloudmigration.CloudMigrationSession, force bool) error {
	if session.Workflow == cloudmigration.SessionWorkflowBuildingSnapshot {
		return cloudmigration.SessionConflictError{
			Workflow:          session.Workflow,
			ActiveSnapshotUID: session.ActiveSnapshotUID,
			CanForce:          false,
		}
	}

	if session.Workflow == "" || session.Workflow == cloudmigration.SessionWorkflowIdle {
		return nil
	}

	if !force {
		return cloudmigration.SessionConflictError{
			Workflow:          session.Workflow,
			ActiveSnapshotUID: session.ActiveSnapshotUID,
			CanForce:          true,
		}
	}

	if err := s.cancelActiveSessionOperation(ctx, orgID, session); err != nil {
		return err
	}

	refreshed, err := s.store.GetMigrationSessionByUID(ctx, orgID, session.UID)
	if err != nil {
		return err
	}
	if refreshed.Workflow == cloudmigration.SessionWorkflowBuildingSnapshot {
		return cloudmigration.SessionConflictError{
			Workflow:          refreshed.Workflow,
			ActiveSnapshotUID: refreshed.ActiveSnapshotUID,
			CanForce:          false,
		}
	}
	if refreshed.Workflow != cloudmigration.SessionWorkflowIdle && refreshed.Workflow != "" {
		return cloudmigration.SessionConflictError{
			Workflow:          refreshed.Workflow,
			ActiveSnapshotUID: refreshed.ActiveSnapshotUID,
			CanForce:          true,
		}
	}
	return nil
}

func (s *Service) cancelActiveSessionOperation(ctx context.Context, orgID int64, session *cloudmigration.CloudMigrationSession) error {
	if session.ActiveSnapshotUID == "" {
		return s.resetSessionWorkflow(ctx, orgID, session.UID)
	}

	snapshot, err := s.store.GetSnapshotByUID(ctx, orgID, session.UID, session.ActiveSnapshotUID, cloudmigration.SnapshotResultQueryParams{
		ResultPage:  1,
		ResultLimit: 1,
	})
	if err != nil && !errors.Is(err, cloudmigration.ErrSnapshotNotFound) {
		return fmt.Errorf("fetching active snapshot: %w", err)
	}

	if session.Workflow == cloudmigration.SessionWorkflowProcessingSnapshot && snapshot != nil {
		if err := s.gmsClient.CancelSnapshot(ctx, *session, *snapshot); err != nil {
			s.log.Warn("failed to cancel snapshot in GMS", "err", err.Error(), "snapshotUid", snapshot.UID)
		}
	}

	s.requestLocalOperationCancel()

	if snapshot != nil {
		if err := s.updateSnapshotWithRetries(ctx, cloudmigration.UpdateSnapshotCmd{
			UID:       snapshot.UID,
			SessionID: session.UID,
			Status:    cloudmigration.SnapshotStatusCanceled,
		}); err != nil {
			return err
		}
	}

	return s.resetSessionWorkflow(ctx, orgID, session.UID)
}

func (s *Service) requestLocalOperationCancel() {
	defer func() {
		if r := recover(); r != nil {
			// cancelFunc may be nil if no local async operation is running on this replica
		}
	}()
	if s.cancelFunc != nil {
		s.cancelFunc()
	}
}

func (s *Service) operationCanceled(ctx context.Context, sessionUID, snapshotUID string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	status, err := s.store.GetSnapshotStatus(ctx, sessionUID, snapshotUID)
	if err != nil {
		return err
	}
	if status == cloudmigration.SnapshotStatusCanceled {
		return cloudmigration.ErrSnapshotCanceled
	}
	return nil
}

func (s *Service) completeBuildingSession(ctx context.Context, orgID int64, sessionUID, snapshotUID string) {
	active := snapshotUID
	if err := s.transitionSessionWorkflow(ctx, orgID, sessionUID,
		cloudmigration.SessionWorkflowBuildingSnapshot,
		cloudmigration.SessionWorkflowIdle,
		&active,
	); err != nil {
		var mismatch cloudmigration.SessionWorkflowMismatchError
		if errors.As(err, &mismatch) {
			_ = s.resetSessionWorkflow(ctx, orgID, sessionUID)
			return
		}
		s.log.Error("failed to transition session workflow after building snapshot", "err", err.Error(), "sessionUid", sessionUID)
	}
}

func (s *Service) completeUploadingSession(ctx context.Context, orgID int64, sessionUID, snapshotUID string) error {
	active := snapshotUID
	if err := s.transitionSessionWorkflow(ctx, orgID, sessionUID,
		cloudmigration.SessionWorkflowUploadingSnapshot,
		cloudmigration.SessionWorkflowProcessingSnapshot,
		&active,
	); err != nil {
		return sessionConflictFromMismatch(err, false)
	}
	return nil
}

func (s *Service) completeProcessingSession(ctx context.Context, orgID int64, sessionUID, snapshotUID string) {
	active := snapshotUID
	if err := s.transitionSessionWorkflow(ctx, orgID, sessionUID,
		cloudmigration.SessionWorkflowProcessingSnapshot,
		cloudmigration.SessionWorkflowIdle,
		&active,
	); err != nil {
		var mismatch cloudmigration.SessionWorkflowMismatchError
		if errors.As(err, &mismatch) {
			_ = s.resetSessionWorkflow(ctx, orgID, sessionUID)
			return
		}
		s.log.Error("failed to transition session workflow after processing snapshot", "err", err.Error(), "sessionUid", sessionUID)
	}
}

func (s *Service) releaseSessionAfterFailedUpload(ctx context.Context, orgID int64, sessionUID string) {
	if err := s.transitionSessionWorkflow(ctx, orgID, sessionUID,
		cloudmigration.SessionWorkflowUploadingSnapshot,
		cloudmigration.SessionWorkflowIdle,
		nil,
	); err != nil {
		_ = s.resetSessionWorkflow(ctx, orgID, sessionUID)
	}
}
