package dashboardcomments

import (
	"context"
	"time"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
)

type ServiceImpl struct {
	store  store
	logger log.Logger
}

func ProvideService(database db.DB) Service {
	return &ServiceImpl{
		store:  &sqlStore{db: database},
		logger: log.New("dashboardcomments"),
	}
}

func (s *ServiceImpl) ListThreads(ctx context.Context, q *ListThreadsQuery) ([]*Thread, error) {
	if q.OrgID == 0 || q.DashboardUID == "" {
		return nil, ErrValidationFailed
	}
	return s.store.ListThreads(ctx, q.OrgID, q.DashboardUID)
}

func (s *ServiceImpl) CreateThread(ctx context.Context, cmd *CreateThreadCommand) (*Thread, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	thread := &Thread{
		OrgID:             cmd.OrgID,
		DashboardUID:      cmd.DashboardUID,
		AnchorPanelKey:    cmd.AnchorPanelKey,
		AnchorXNorm:       cmd.AnchorXNorm,
		AnchorYNorm:       cmd.AnchorYNorm,
		ContextPanelTitle: cmd.ContextPanelTitle,
		ContextTimeFrom:   cmd.ContextTimeFrom,
		ContextTimeTo:     cmd.ContextTimeTo,
		CreatedByUserID:   cmd.CreatedByUserID,
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	firstMessage := &Message{
		AuthorUserID: cmd.CreatedByUserID,
		Body:         cmd.InitialBody,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	return s.store.InsertThread(ctx, thread, firstMessage)
}

func (s *ServiceImpl) UpdateThread(ctx context.Context, cmd *UpdateThreadCommand) (*Thread, error) {
	if cmd.OrgID == 0 || cmd.ThreadID == 0 || cmd.ActingUserID == 0 {
		return nil, ErrValidationFailed
	}
	existing, err := s.store.GetThread(ctx, cmd.OrgID, cmd.ThreadID)
	if err != nil {
		return nil, err
	}
	if !cmd.IsDashEditor && existing.CreatedByUserID != cmd.ActingUserID {
		return nil, ErrForbidden
	}
	now := time.Now().UTC()
	if cmd.Resolved != nil {
		existing.Resolved = *cmd.Resolved
		if *cmd.Resolved {
			existing.ResolvedByUserID = cmd.ActingUserID
			existing.ResolvedAt = now
		} else {
			existing.ResolvedByUserID = 0
			existing.ResolvedAt = time.Time{}
		}
	}
	existing.UpdatedAt = now
	if err := s.store.UpdateThread(ctx, existing); err != nil {
		return nil, err
	}
	return s.store.GetThread(ctx, cmd.OrgID, cmd.ThreadID)
}

func (s *ServiceImpl) DeleteThread(ctx context.Context, cmd *DeleteThreadCommand) error {
	if cmd.OrgID == 0 || cmd.ThreadID == 0 || cmd.ActingUserID == 0 {
		return ErrValidationFailed
	}
	existing, err := s.store.GetThread(ctx, cmd.OrgID, cmd.ThreadID)
	if err != nil {
		return err
	}
	if !cmd.IsDashEditor && existing.CreatedByUserID != cmd.ActingUserID {
		return ErrForbidden
	}
	return s.store.DeleteThread(ctx, cmd.OrgID, cmd.ThreadID)
}

func (s *ServiceImpl) AddMessage(ctx context.Context, cmd *AddMessageCommand) (*Message, error) {
	if err := cmd.Validate(); err != nil {
		return nil, err
	}
	if _, err := s.store.GetThread(ctx, cmd.OrgID, cmd.ThreadID); err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	msg := &Message{
		ThreadID:     cmd.ThreadID,
		AuthorUserID: cmd.AuthorUserID,
		Body:         cmd.Body,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	return s.store.InsertMessage(ctx, msg)
}

func (s *ServiceImpl) DeleteMessage(ctx context.Context, cmd *DeleteMessageCommand) error {
	if cmd.OrgID == 0 || cmd.MessageID == 0 || cmd.ActingUserID == 0 {
		return ErrValidationFailed
	}
	existing, err := s.store.GetMessage(ctx, cmd.MessageID)
	if err != nil {
		return err
	}
	if !cmd.IsDashEditor && existing.AuthorUserID != cmd.ActingUserID {
		return ErrForbidden
	}
	return s.store.DeleteMessage(ctx, cmd.MessageID)
}
