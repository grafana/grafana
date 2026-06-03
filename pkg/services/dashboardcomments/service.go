package dashboardcomments

import (
	"context"
	"fmt"
	"regexp"
	"time"
	"unicode/utf8"

	notificationsv0alpha1 "github.com/grafana/grafana/apps/notifications/pkg/apis/notifications/v0alpha1"
	client "github.com/grafana/grafana/apps/notifications/pkg/client"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/user"
)

type ServiceImpl struct {
	store    store
	userSvc  user.Service
	notifier client.Notifier
	logger   log.Logger
}

func ProvideService(database db.DB, userSvc user.Service, notifier client.Notifier) Service {
	return &ServiceImpl{
		store:    &sqlStore{db: database},
		userSvc:  userSvc,
		notifier: notifier,
		logger:   log.New("dashboardcomments"),
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
		AuthorType:   AuthorTypeUser,
		Body:         cmd.InitialBody,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	created, err := s.store.InsertThread(ctx, thread, firstMessage)
	if err != nil {
		return nil, err
	}
	s.notifyMentions(ctx, cmd.OrgID, cmd.CreatedByUserID, cmd.InitialBody, cmd.DashboardUID, created.ID, 0)
	return created, nil
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
	existing, err := s.store.GetThread(ctx, cmd.OrgID, cmd.ThreadID)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	msg := &Message{
		ThreadID:     cmd.ThreadID,
		AuthorUserID: cmd.AuthorUserID,
		AuthorType:   cmd.AuthorType,
		Body:         cmd.Body,
		CreatedAt:    now,
		UpdatedAt:    now,
	}
	msg, err = s.store.InsertMessage(ctx, msg)
	if err != nil {
		return nil, err
	}
	s.notifyMentions(ctx, cmd.OrgID, cmd.AuthorUserID, cmd.Body, existing.DashboardUID, cmd.ThreadID, msg.ID)
	return msg, nil
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
var mentionRe = regexp.MustCompile(`@([A-Za-z0-9._-]+)`)

func extractMentions(body string) []string {
	matches := mentionRe.FindAllStringSubmatch(body, -1)
	seen := map[string]struct{}{}
	var out []string
	for _, m := range matches {
		if _, ok := seen[m[1]]; ok {
			continue
		}
		seen[m[1]] = struct{}{}
		out = append(out, m[1])
	}
	return out
}

func (s *ServiceImpl) notifyMentions(
	ctx context.Context,
	orgID int64,
	actorUserID int64,
	body string,
	dashboardUID string,
	threadID int64,
	messageID int64,
) {
	logins := extractMentions(body)
	if len(logins) == 0 {
		return
	}

	actor, err := s.userSvc.GetByID(ctx, &user.GetUserByIDQuery{ID: actorUserID})
	if err != nil {
		s.logger.Warn("notify: actor lookup failed", "error", err)
		return
	}

	for _, login := range logins {
		if login == actor.Login {
			continue
		}
		recipient, err := s.userSvc.GetByLogin(ctx, &user.GetUserByLoginQuery{LoginOrEmail: login})
		if err != nil {
			s.logger.Warn("notify: recipient lookup failed", "login", login, "error", err)
			continue
		}

		excerpt := body
		if utf8.RuneCountInString(excerpt) > 280 {
			runes := []rune(excerpt)
			excerpt = string(runes[:280])
		}

		actorName := actor.Name
		if actorName == "" {
			actorName = actor.Login
		}

		n := notificationsv0alpha1.NewNotification()
		n.Name = fmt.Sprintf("comment-%d-%d-%s", threadID, messageID, recipient.UID)
		n.Spec.RecipientUID = recipient.UID
		n.Spec.OrgID = orgID
		n.Spec.Type = notificationsv0alpha1.NotificationSpecTypeMention
		n.Spec.CreatedAt = time.Now().UTC().Format(time.RFC3339)
		n.Spec.Source.Kind = "comment"
		n.Spec.Source.CommentUID = fmt.Sprintf("msg-%d", messageID)
		n.Spec.Source.ThreadUID = fmt.Sprintf("thread-%d", threadID)
		n.Spec.Source.DashboardUID = dashboardUID
		n.Spec.Source.DeepLink = fmt.Sprintf("/d/%s?commentThread=%d&comment=%d", dashboardUID, threadID, messageID)
		n.Spec.Actor.Uid = actor.UID
		n.Spec.Actor.Login = actor.Login
		n.Spec.Actor.Name = actorName
		n.Spec.Excerpt = excerpt

		if err := s.notifier.Create(ctx, n); err != nil {
			s.logger.Warn("notify: create failed", "login", login, "error", err)
		}
	}
}
