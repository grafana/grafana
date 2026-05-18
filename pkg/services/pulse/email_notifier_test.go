package pulse

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/notifications"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// captureMailer records every SendEmailCommand handed to it so tests can
// assert on subject/template/data without spinning up a real SMTP stack.
type captureMailer struct {
	mu       sync.Mutex
	commands []*notifications.SendEmailCommand
	errOn    map[string]error // keyed by recipient email
}

func (m *captureMailer) SendEmailCommandHandlerSync(_ context.Context, cmd *notifications.SendEmailCommandSync) error {
	return nil
}

func (m *captureMailer) SendEmailCommandHandler(_ context.Context, cmd *notifications.SendEmailCommand) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.errOn != nil && len(cmd.To) > 0 {
		if err, ok := m.errOn[cmd.To[0]]; ok {
			return err
		}
	}
	m.commands = append(m.commands, cmd)
	return nil
}

// mapUserService is a per-id user.Service fake. Returning a user is enough
// for these tests since the EmailNotifier only reads Email/Name/Login/IsDisabled.
type mapUserService struct {
	user.Service
	users map[int64]*user.User
	err   map[int64]error
}

func (s *mapUserService) GetByID(_ context.Context, q *user.GetUserByIDQuery) (*user.User, error) {
	if err, ok := s.err[q.ID]; ok {
		return nil, err
	}
	u, ok := s.users[q.ID]
	if !ok {
		return nil, errors.New("user not found")
	}
	return u, nil
}

func newEmailNotifier(t *testing.T, users *mapUserService, mailer *captureMailer) *EmailNotifier {
	t.Helper()
	return NewEmailNotifier(mailer, users, &setting.Cfg{AppURL: "http://localhost:3000/"}, log.New("pulse.test"))
}

func TestEmailNotifier_MentionUsesMentionTemplate(t *testing.T) {
	users := &mapUserService{users: map[int64]*user.User{
		1: {ID: 1, Email: "author@example.com", Name: "Alice Author"},
		2: {ID: 2, Email: "mentioned@example.com", Name: "Bob"},
	}}
	mailer := &captureMailer{}
	n := newEmailNotifier(t, users, mailer)

	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{2},
		BodyText:     "Hey Bob look at this",
		IsMention:    map[int64]bool{2: true},
		ThreadTitle:  "Latency spike",
		Reason:       ReasonMention,
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)

	cmd := mailer.commands[0]
	assert.Equal(t, []string{"mentioned@example.com"}, cmd.To)
	assert.Equal(t, tmplPulseMention, cmd.Template)
	assert.Contains(t, cmd.Subject, "Alice Author mentioned you")
	assert.Contains(t, cmd.Subject, "Latency spike")
	assert.Equal(t, "Alice Author", cmd.Data["AuthorName"])
	assert.Equal(t, "Latency spike", cmd.Data["ThreadTitle"])
	assert.Equal(t, true, cmd.Data["IsMention"])
	assert.Equal(t, "http://localhost:3000/d/dash-uid?pulse=thread-thread-uid", cmd.Data["ThreadURL"])
}

func TestEmailNotifier_SubscriberUsesReplyTemplate(t *testing.T) {
	users := &mapUserService{users: map[int64]*user.User{
		1: {ID: 1, Email: "author@example.com", Name: "Alice"},
		3: {ID: 3, Email: "sub@example.com", Name: "Carol Subscriber"},
	}}
	mailer := &captureMailer{}
	n := newEmailNotifier(t, users, mailer)

	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{3},
		BodyText:     "Adding more context here",
		IsMention:    map[int64]bool{},
		ThreadTitle:  "Latency spike",
		Reason:       ReasonSubscription,
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)

	cmd := mailer.commands[0]
	assert.Equal(t, tmplPulseReply, cmd.Template)
	assert.Contains(t, cmd.Subject, "New reply")
	assert.Equal(t, false, cmd.Data["IsMention"])
	assert.Equal(t, "Carol Subscriber", cmd.Data["RecipientName"])
}

func TestEmailNotifier_SkipsDisabledUserAndEmptyEmail(t *testing.T) {
	users := &mapUserService{users: map[int64]*user.User{
		1: {ID: 1, Email: "author@example.com", Name: "Alice"},
		2: {ID: 2, Email: "ok@example.com", Name: "Bob"},
		3: {ID: 3, Email: "disabled@example.com", Name: "Dave", IsDisabled: true},
		4: {ID: 4, Email: "", Name: "NoEmail"},
	}}
	mailer := &captureMailer{}
	n := newEmailNotifier(t, users, mailer)

	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{2, 3, 4},
		BodyText:     "hi",
		IsMention:    map[int64]bool{2: true, 3: true, 4: true},
		ThreadTitle:  "Thread",
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)
	assert.Equal(t, []string{"ok@example.com"}, mailer.commands[0].To)
}

func TestEmailNotifier_LookupErrorDoesNotAbortLoop(t *testing.T) {
	users := &mapUserService{
		users: map[int64]*user.User{
			1: {ID: 1, Email: "author@example.com", Name: "Alice"},
			3: {ID: 3, Email: "ok@example.com", Name: "Carol"},
		},
		err: map[int64]error{2: errors.New("boom")},
	}
	mailer := &captureMailer{}
	n := newEmailNotifier(t, users, mailer)

	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{2, 3},
		BodyText:     "hi",
		IsMention:    map[int64]bool{2: true, 3: true},
		ThreadTitle:  "Thread",
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)
	assert.Equal(t, []string{"ok@example.com"}, mailer.commands[0].To)
}

func TestEmailNotifier_SendErrorDoesNotAbortLoop(t *testing.T) {
	users := &mapUserService{users: map[int64]*user.User{
		1: {ID: 1, Email: "author@example.com", Name: "Alice"},
		2: {ID: 2, Email: "fails@example.com", Name: "Failsworth"},
		3: {ID: 3, Email: "ok@example.com", Name: "Carol"},
	}}
	mailer := &captureMailer{errOn: map[string]error{"fails@example.com": errors.New("smtp down")}}
	n := newEmailNotifier(t, users, mailer)

	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{2, 3},
		BodyText:     "hi",
		IsMention:    map[int64]bool{2: true, 3: true},
		ThreadTitle:  "Thread",
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)
	assert.Equal(t, []string{"ok@example.com"}, mailer.commands[0].To)
}

func TestEmailNotifier_NonDashboardFallsBackToPulseOverview(t *testing.T) {
	users := &mapUserService{users: map[int64]*user.User{
		1: {ID: 1, Email: "author@example.com", Name: "Alice"},
		2: {ID: 2, Email: "bob@example.com", Name: "Bob"},
	}}
	mailer := &captureMailer{}
	n := newEmailNotifier(t, users, mailer)

	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKind("slo"), // anything other than dashboard
		ResourceUID:  "slo-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{2},
		IsMention:    map[int64]bool{2: true},
		ThreadTitle:  "SLO discussion",
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)
	url, ok := mailer.commands[0].Data["ThreadURL"].(string)
	require.True(t, ok)
	assert.True(t, strings.HasSuffix(url, "/pulse?thread=thread-uid"), "got %s", url)
}

func TestEmailNotifier_TruncatesLongBodyPreview(t *testing.T) {
	users := &mapUserService{users: map[int64]*user.User{
		1: {ID: 1, Email: "author@example.com", Name: "Alice"},
		2: {ID: 2, Email: "bob@example.com", Name: "Bob"},
	}}
	mailer := &captureMailer{}
	n := newEmailNotifier(t, users, mailer)

	long := strings.Repeat("a", emailBodyPreviewBytes+50)
	err := n.NotifyPulse(context.Background(), PulseNotification{
		OrgID:        1,
		ResourceKind: ResourceKindDashboard,
		ResourceUID:  "dash-uid",
		ThreadUID:    "thread-uid",
		AuthorUserID: 1,
		Recipients:   []int64{2},
		BodyText:     long,
		IsMention:    map[int64]bool{2: true},
		ThreadTitle:  "Thread",
	})
	require.NoError(t, err)
	require.Len(t, mailer.commands, 1)
	preview, _ := mailer.commands[0].Data["BodyPreview"].(string)
	assert.Less(t, len(preview), len(long))
	assert.True(t, strings.HasSuffix(preview, "…"))
}

// failingNotifier returns an error from NotifyPulse so MultiNotifier tests
// can verify siblings still run.
type failingNotifier struct {
	called bool
}

func (f *failingNotifier) NotifyPulse(_ context.Context, _ PulseNotification) error {
	f.called = true
	return errors.New("boom")
}

type recordingNotifier struct {
	called bool
}

func (r *recordingNotifier) NotifyPulse(_ context.Context, _ PulseNotification) error {
	r.called = true
	return nil
}

func TestMultiNotifier_ErrorInChildDoesNotStopSiblings(t *testing.T) {
	bad := &failingNotifier{}
	good := &recordingNotifier{}
	m := &MultiNotifier{Log: log.New("pulse.test"), Notifiers: []Notifier{bad, good}}

	err := m.NotifyPulse(context.Background(), PulseNotification{})
	require.NoError(t, err)
	assert.True(t, bad.called)
	assert.True(t, good.called)
}

func TestMultiNotifier_NilChildIsSkipped(t *testing.T) {
	good := &recordingNotifier{}
	m := &MultiNotifier{Log: log.New("pulse.test"), Notifiers: []Notifier{nil, good}}

	err := m.NotifyPulse(context.Background(), PulseNotification{})
	require.NoError(t, err)
	assert.True(t, good.called)
}
