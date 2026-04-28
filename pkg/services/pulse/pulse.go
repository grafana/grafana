package pulse

import (
	"context"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/util"
)

var logger = log.New("pulse")

// Service is the public surface of the Pulse domain. Handlers and other
// services depend on this interface; the concrete *PulseService is private
// to the package.
type Service interface {
	CreateThread(ctx context.Context, cmd CreateThreadCommand) (CreateThreadResult, error)
	AddPulse(ctx context.Context, cmd AddPulseCommand) (Pulse, error)
	EditPulse(ctx context.Context, cmd EditPulseCommand) (Pulse, error)
	DeletePulse(ctx context.Context, cmd DeletePulseCommand) error
	GetThread(ctx context.Context, orgID int64, uid string) (Thread, error)
	ListThreads(ctx context.Context, q ListThreadsQuery) (PageResult[Thread], error)
	ListPulses(ctx context.Context, q ListPulsesQuery) (PageResult[Pulse], error)
	Subscribe(ctx context.Context, cmd SubscribeCommand) error
	Unsubscribe(ctx context.Context, cmd SubscribeCommand) error
	MarkRead(ctx context.Context, cmd MarkReadCommand) error
	GetResourceVersion(ctx context.Context, orgID int64, kind ResourceKind, uid string) (ResourceVersion, error)
}

// PulseService is the in-memory implementation backed by SQL.
type PulseService struct {
	cfg           PulseConfig
	store         *store
	live          Publisher
	notifier      Notifier
	accessControl accesscontrol.AccessControl
	routeRegister routing.RouteRegister
	features      featuremgmt.FeatureToggles
	userSvc       user.Service
	dashSvc       dashboards.DashboardService
	log           log.Logger
}

// PulseConfig holds runtime tunables, mostly for tests.
type PulseConfig struct {
	// MaxBodyBytes overrides the default body size cap.
	MaxBodyBytes int
}

// ProvideService is the wire entry point for the Pulse service.
func ProvideService(
	sqlStore db.DB,
	routeRegister routing.RouteRegister,
	ac accesscontrol.AccessControl,
	features featuremgmt.FeatureToggles,
	userSvc user.Service,
	dashSvc dashboards.DashboardService,
	channelPub ChannelPublisher,
) (*PulseService, error) {
	s := &PulseService{
		cfg:           PulseConfig{MaxBodyBytes: MaxBodyBytes},
		store:         newStore(sqlStore),
		live:          NewLivePublisher(channelPub),
		notifier:      &LogOnlyNotifier{Log: logger},
		accessControl: ac,
		routeRegister: routeRegister,
		features:      features,
		userSvc:       userSvc,
		dashSvc:       dashSvc,
		log:           logger,
	}

	s.registerAPIEndpoints()
	return s, nil
}

// SetPublisher swaps the live publisher after construction. wire calls this
// from a separate provider that depends on GrafanaLive, breaking what would
// otherwise be a cycle (live depends on dashboards, dashboards depend on
// pulse... etc.).
func (s *PulseService) SetPublisher(p Publisher) {
	if p != nil {
		s.live = p
	}
}

// SetNotifier swaps the notifier (used for testing and to layer in real
// email/webhook delivery later).
func (s *PulseService) SetNotifier(n Notifier) {
	if n != nil {
		s.notifier = n
	}
}

// CreateThread creates a new thread plus its first pulse. All-or-nothing.
func (s *PulseService) CreateThread(ctx context.Context, cmd CreateThreadCommand) (CreateThreadResult, error) {
	if err := ensureThreadResource(cmd.ResourceKind, cmd.ResourceUID); err != nil {
		return CreateThreadResult{}, err
	}
	if cmd.AuthorKind == "" {
		cmd.AuthorKind = AuthorKindUser
	}

	parsed, err := ParseAndValidateBody(cmd.Body)
	if err != nil {
		return CreateThreadResult{}, err
	}

	now := time.Now().UTC()
	thread := Thread{
		UID:          util.GenerateShortUID(),
		OrgID:        cmd.OrgID,
		ResourceKind: cmd.ResourceKind,
		ResourceUID:  cmd.ResourceUID,
		PanelID:      cmd.PanelID,
		Title:        cmd.Title,
		CreatedBy:    cmd.AuthorUserID,
		Created:      now,
		Updated:      now,
		LastPulseAt:  now,
		PulseCount:   1,
		Version:      1,
	}
	pulse := Pulse{
		UID:          util.GenerateShortUID(),
		ThreadUID:    thread.UID,
		OrgID:        cmd.OrgID,
		AuthorUserID: cmd.AuthorUserID,
		AuthorKind:   cmd.AuthorKind,
		BodyText:     parsed.Text,
		BodyJSON:     cmd.Body,
		Created:      now,
		Updated:      now,
	}

	mentions := DedupeMentions(parsed.Mentions)
	if err := s.store.insertThreadAndPulse(ctx, thread, pulse, mentions); err != nil {
		return CreateThreadResult{}, err
	}

	// Author is auto-subscribed so they get reply notifications.
	_ = s.store.upsertSubscription(ctx, Subscription{
		OrgID: cmd.OrgID, ThreadUID: thread.UID, UserID: cmd.AuthorUserID, SubscribedAt: now,
	})

	s.publishEvent(Event{
		Action:       EventThreadCreated,
		OrgID:        cmd.OrgID,
		ResourceKind: string(cmd.ResourceKind),
		ResourceUID:  cmd.ResourceUID,
		ThreadUID:    thread.UID,
		PulseUID:     pulse.UID,
		AuthorUserID: cmd.AuthorUserID,
		At:           now,
	})
	s.fanout(ctx, thread, pulse, mentions)

	return CreateThreadResult{Thread: thread, Pulse: pulse}, nil
}

// AddPulse appends a pulse to an existing thread.
func (s *PulseService) AddPulse(ctx context.Context, cmd AddPulseCommand) (Pulse, error) {
	if cmd.AuthorKind == "" {
		cmd.AuthorKind = AuthorKindUser
	}
	parsed, err := ParseAndValidateBody(cmd.Body)
	if err != nil {
		return Pulse{}, err
	}
	now := time.Now().UTC()
	pulse := Pulse{
		UID:          util.GenerateShortUID(),
		ThreadUID:    cmd.ThreadUID,
		ParentUID:    cmd.ParentUID,
		OrgID:        cmd.OrgID,
		AuthorUserID: cmd.AuthorUserID,
		AuthorKind:   cmd.AuthorKind,
		BodyText:     parsed.Text,
		BodyJSON:     cmd.Body,
		Created:      now,
		Updated:      now,
	}
	mentions := DedupeMentions(parsed.Mentions)
	thread, err := s.store.insertPulse(ctx, pulse, mentions)
	if err != nil {
		return Pulse{}, err
	}

	// Author is auto-subscribed on first reply.
	_ = s.store.upsertSubscription(ctx, Subscription{
		OrgID: cmd.OrgID, ThreadUID: thread.UID, UserID: cmd.AuthorUserID, SubscribedAt: now,
	})

	s.publishEvent(Event{
		Action:       EventPulseAdded,
		OrgID:        cmd.OrgID,
		ResourceKind: string(thread.ResourceKind),
		ResourceUID:  thread.ResourceUID,
		ThreadUID:    thread.UID,
		PulseUID:     pulse.UID,
		AuthorUserID: cmd.AuthorUserID,
		At:           now,
	})
	s.fanout(ctx, thread, pulse, mentions)
	return pulse, nil
}

// EditPulse replaces the body of an existing pulse. Only the original
// author can edit. The edited bit is set so the UI can render an "(edited)"
// hint.
func (s *PulseService) EditPulse(ctx context.Context, cmd EditPulseCommand) (Pulse, error) {
	parsed, err := ParseAndValidateBody(cmd.NewBody)
	if err != nil {
		return Pulse{}, err
	}
	existing, err := s.store.getPulseByUID(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		return Pulse{}, err
	}
	if existing.AuthorUserID != cmd.UserID {
		return Pulse{}, ErrCannotEditNotAuthor
	}
	if existing.Deleted {
		return Pulse{}, ErrPulseAlreadyDeleted
	}

	existing.BodyText = parsed.Text
	existing.BodyJSON = cmd.NewBody
	existing.Updated = time.Now().UTC()
	existing.Edited = true

	mentions := DedupeMentions(parsed.Mentions)
	if err := s.store.updatePulseBody(ctx, existing, mentions); err != nil {
		return Pulse{}, err
	}

	thread, err := s.store.getThreadByUID(ctx, cmd.OrgID, existing.ThreadUID)
	if err == nil {
		s.publishEvent(Event{
			Action:       EventPulseEdited,
			OrgID:        cmd.OrgID,
			ResourceKind: string(thread.ResourceKind),
			ResourceUID:  thread.ResourceUID,
			ThreadUID:    thread.UID,
			PulseUID:     existing.UID,
			AuthorUserID: cmd.UserID,
			At:           existing.Updated,
		})
	}
	return existing, nil
}

// DeletePulse soft-deletes a pulse. Author or admin can delete. The body is
// retained in the row but the API no longer returns it; this preserves the
// thread shape while giving users a way to retract.
func (s *PulseService) DeletePulse(ctx context.Context, cmd DeletePulseCommand) error {
	existing, err := s.store.getPulseByUID(ctx, cmd.OrgID, cmd.UID)
	if err != nil {
		return err
	}
	if !cmd.IsAdmin && existing.AuthorUserID != cmd.UserID {
		return ErrCannotDeleteForbidden
	}
	if err := s.store.softDelete(ctx, cmd.OrgID, cmd.UID); err != nil {
		return err
	}
	thread, err := s.store.getThreadByUID(ctx, cmd.OrgID, existing.ThreadUID)
	if err == nil {
		s.publishEvent(Event{
			Action:       EventPulseDeleted,
			OrgID:        cmd.OrgID,
			ResourceKind: string(thread.ResourceKind),
			ResourceUID:  thread.ResourceUID,
			ThreadUID:    thread.UID,
			PulseUID:     existing.UID,
			AuthorUserID: cmd.UserID,
			At:           time.Now().UTC(),
		})
	}
	return nil
}

func (s *PulseService) GetThread(ctx context.Context, orgID int64, uid string) (Thread, error) {
	return s.store.getThreadByUID(ctx, orgID, uid)
}

func (s *PulseService) ListThreads(ctx context.Context, q ListThreadsQuery) (PageResult[Thread], error) {
	if err := ensureThreadResource(q.ResourceKind, q.ResourceUID); err != nil {
		return PageResult[Thread]{}, err
	}
	return s.store.listThreads(ctx, q)
}

func (s *PulseService) ListPulses(ctx context.Context, q ListPulsesQuery) (PageResult[Pulse], error) {
	if q.ThreadUID == "" {
		return PageResult[Pulse]{}, ErrThreadNotFound
	}
	return s.store.listPulses(ctx, q)
}

func (s *PulseService) Subscribe(ctx context.Context, cmd SubscribeCommand) error {
	return s.store.upsertSubscription(ctx, Subscription{
		OrgID: cmd.OrgID, ThreadUID: cmd.ThreadUID, UserID: cmd.UserID, SubscribedAt: time.Now().UTC(),
	})
}

func (s *PulseService) Unsubscribe(ctx context.Context, cmd SubscribeCommand) error {
	return s.store.deleteSubscription(ctx, Subscription{
		OrgID: cmd.OrgID, ThreadUID: cmd.ThreadUID, UserID: cmd.UserID,
	})
}

func (s *PulseService) MarkRead(ctx context.Context, cmd MarkReadCommand) error {
	return s.store.upsertReadState(ctx, ReadState{
		OrgID:            cmd.OrgID,
		ThreadUID:        cmd.ThreadUID,
		UserID:           cmd.UserID,
		LastReadPulseUID: cmd.LastReadPulseUID,
		LastReadAt:       time.Now().UTC(),
	})
}

func (s *PulseService) GetResourceVersion(ctx context.Context, orgID int64, kind ResourceKind, uid string) (ResourceVersion, error) {
	if err := ensureThreadResource(kind, uid); err != nil {
		return ResourceVersion{}, err
	}
	return s.store.resourceVersion(ctx, orgID, kind, uid)
}

// publishEvent is best-effort; failures are logged but do not affect the
// HTTP response status. The polling fallback covers missed events.
func (s *PulseService) publishEvent(e Event) {
	if s.live == nil {
		return
	}
	if err := s.live.Publish(e.OrgID, e); err != nil {
		s.log.Warn("failed to publish pulse event", "err", err, "action", e.Action, "threadUID", e.ThreadUID)
	}
}

// fanout collects subscriber + mention recipient ids and dispatches them to
// the notifier. Author is excluded so people don't get pinged for their own
// pulses.
func (s *PulseService) fanout(ctx context.Context, thread Thread, pulse Pulse, mentions []Mention) {
	subs, err := s.store.listSubscribers(ctx, thread.OrgID, thread.UID)
	if err != nil {
		s.log.Warn("failed to list subscribers", "err", err, "threadUID", thread.UID)
	}
	mentionUserIDs := make([]int64, 0)
	isMention := make(map[int64]bool)
	for _, m := range mentions {
		if m.Kind != MentionKindUser {
			continue
		}
		uid := parseUserID(m.TargetID)
		if uid <= 0 {
			continue
		}
		mentionUserIDs = append(mentionUserIDs, uid)
		isMention[uid] = true
	}

	recipients := mergeRecipients(subs, mentionUserIDs, pulse.AuthorUserID)
	if len(recipients) == 0 {
		return
	}
	if err := s.notifier.NotifyPulse(ctx, PulseNotification{
		OrgID:        thread.OrgID,
		ResourceKind: thread.ResourceKind,
		ResourceUID:  thread.ResourceUID,
		ThreadUID:    thread.UID,
		PulseUID:     pulse.UID,
		AuthorUserID: pulse.AuthorUserID,
		Recipients:   recipients,
		BodyText:     pulse.BodyText,
		IsMention:    isMention,
		ThreadTitle:  thread.Title,
		Reason:       reasonFor(isMention, recipients),
	}); err != nil {
		s.log.Warn("notification fanout failed", "err", err, "threadUID", thread.UID)
	}
}

func reasonFor(isMention map[int64]bool, recipients []int64) NotificationReason {
	for _, r := range recipients {
		if isMention[r] {
			return ReasonMention
		}
	}
	return ReasonSubscription
}

// mergeRecipients dedupes subscribers + mentioned users, dropping the
// pulse author so they don't notify themselves.
func mergeRecipients(subs, mentions []int64, author int64) []int64 {
	seen := make(map[int64]bool, len(subs)+len(mentions))
	out := make([]int64, 0, len(subs)+len(mentions))
	add := func(id int64) {
		if id == 0 || id == author || seen[id] {
			return
		}
		seen[id] = true
		out = append(out, id)
	}
	for _, id := range mentions {
		add(id)
	}
	for _, id := range subs {
		add(id)
	}
	return out
}

// parseUserID accepts either a bare numeric id ("42") or a fully-qualified
// "user:42" string in the mention TargetID. Returns 0 for non-numeric.
func parseUserID(s string) int64 {
	const prefix = "user:"
	if len(s) > len(prefix) && s[:len(prefix)] == prefix {
		s = s[len(prefix):]
	}
	var n int64
	for _, c := range s {
		if c < '0' || c > '9' {
			return 0
		}
		n = n*10 + int64(c-'0')
	}
	return n
}

// IsErrNotFound is a convenience predicate the API layer uses to map
// errors to 404s.
func IsErrNotFound(err error) bool {
	return errors.Is(err, ErrThreadNotFound) || errors.Is(err, ErrPulseNotFound)
}
