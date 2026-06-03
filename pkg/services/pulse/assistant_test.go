package pulse

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// fakeResponder is a test double for AssistantResponder. It records the
// request it was handed and returns a canned reply/error.
type fakeResponder struct {
	reply  AssistantReply
	err    error
	gotReq AssistantRequest
	calls  int
}

func (f *fakeResponder) Respond(_ context.Context, req AssistantRequest) (AssistantReply, error) {
	f.calls++
	f.gotReq = req
	return f.reply, f.err
}

func TestHasAssistantMention(t *testing.T) {
	require.False(t, hasAssistantMention(nil))
	require.False(t, hasAssistantMention([]Mention{{Kind: MentionKindUser, TargetID: "1"}}))
	require.True(t, hasAssistantMention([]Mention{
		{Kind: MentionKindUser, TargetID: "1"},
		{Kind: MentionKindAssistant, TargetID: AssistantMentionTarget},
	}))
}

func TestMentionKindAssistantValid(t *testing.T) {
	require.True(t, MentionKindAssistant.Valid())
}

func TestBuildAssistantReplyBodyRoundTrips(t *testing.T) {
	raw, err := buildAssistantReplyBody("**hi** there")
	require.NoError(t, err)

	parsed, err := ParseAndValidateBody(raw)
	require.NoError(t, err)
	// The markdown source wins the text projection, so body_text is the
	// markdown verbatim.
	require.Equal(t, "**hi** there", parsed.Text)
}

func TestStubAssistantResponderEchoesPrompt(t *testing.T) {
	r := &StubAssistantResponder{Log: log.New("pulse.test")}
	reply, err := r.Respond(context.Background(), AssistantRequest{PromptText: "why is latency high?"})
	require.NoError(t, err)
	require.Contains(t, reply.Markdown, "Grafana Assistant")
	require.Contains(t, reply.Markdown, "why is latency high?")
}

func TestAssistantEnabledGate(t *testing.T) {
	s := newTestService(t)

	// No responder, no features → disabled.
	require.False(t, s.assistantEnabled())

	// Responder set but features still nil → disabled.
	s.assistantResponder = &StubAssistantResponder{Log: log.New("pulse.test")}
	require.False(t, s.assistantEnabled())

	// Responder set + toggle off → disabled.
	s.features = featuremgmt.WithFeatures()
	require.False(t, s.assistantEnabled())

	// Responder set + toggle on → enabled.
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)
	require.True(t, s.assistantEnabled())
}

func TestIntegrationRespondAsAssistant_PostsServiceAccountReply(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	fake := &fakeResponder{reply: AssistantReply{Markdown: "Here's what I found."}}
	s.assistantResponder = fake

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hey "},{"type":"mention","mention":{"kind":"assistant","targetId":"assistant","displayName":"Grafana Assistant"}}]}]},"markdown":"hey ` + "`@Grafana Assistant`" + `"}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Title: "demo", Body: body,
	})
	require.NoError(t, err)

	// Drive the reply synchronously (production dispatches this on a
	// detached goroutine; tests call it directly to stay deterministic).
	s.respondAsAssistant(ctx, res.Thread, res.Pulse)

	// The responder saw the triggering pulse's context.
	require.Equal(t, 1, fake.calls)
	require.Equal(t, res.Thread.UID, fake.gotReq.ThreadUID)
	require.Equal(t, res.Pulse.UID, fake.gotReq.PulseUID)

	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)

	reply := page.Items[1]
	require.Equal(t, AuthorKindServiceAccount, reply.AuthorKind)
	require.Equal(t, AssistantAuthorUserID, reply.AuthorUserID)
	require.Equal(t, res.Pulse.UID, reply.ParentUID)
	require.Equal(t, "Here's what I found.", reply.BodyText)

	// The API author hydration stamps a friendly name on assistant pulses
	// even though there's no user row behind the sentinel id.
	hydrated := []Pulse{reply}
	s.populateAuthorDisplay(ctx, hydrated)
	require.Equal(t, AssistantDisplayName, hydrated[0].AuthorName)
	require.Equal(t, AssistantLogin, hydrated[0].AuthorLogin)
}

func TestIntegrationRespondAsAssistant_SkipsEmptyAndErrorReplies(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()

	for _, tc := range []struct {
		name string
		fake *fakeResponder
	}{
		{"empty reply", &fakeResponder{reply: AssistantReply{Markdown: "   "}}},
		{"responder error", &fakeResponder{err: errors.New("model unavailable")}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			s := newTestService(t)
			s.assistantResponder = tc.fake
			body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"q"}]}]}}`)
			res, err := s.CreateThread(ctx, CreateThreadCommand{
				OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Body: body,
			})
			require.NoError(t, err)

			s.respondAsAssistant(ctx, res.Thread, res.Pulse)

			// No reply was posted — the thread still has just the parent pulse.
			page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
			require.NoError(t, err)
			require.Len(t, page.Items, 1)
		})
	}
}
