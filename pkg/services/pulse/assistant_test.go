package pulse

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

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

func TestAssistantEnabledGate(t *testing.T) {
	s := newTestService(t)

	// No features wired → disabled.
	require.False(t, s.assistantEnabled())

	// Toggle off → disabled.
	s.features = featuremgmt.WithFeatures()
	require.False(t, s.assistantEnabled())

	// Toggle on → enabled.
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)
	require.True(t, s.assistantEnabled())
}

func TestIntegrationAddAssistantReply_PostsServiceAccountReply(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)

	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hey "},{"type":"mention","mention":{"kind":"assistant","targetId":"assistant","displayName":"Grafana Assistant"}}]}]},"markdown":"hey ` + "`@Grafana Assistant`" + `"}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Title: "demo", Body: body,
	})
	require.NoError(t, err)

	reply, err := s.AddAssistantReply(ctx, AddAssistantReplyCommand{
		OrgID:     1,
		ThreadUID: res.Thread.UID,
		ParentUID: res.Pulse.UID,
		Markdown:  "Here's what I found.",
	})
	require.NoError(t, err)
	require.Equal(t, AuthorKindServiceAccount, reply.AuthorKind)
	require.Equal(t, AssistantAuthorUserID, reply.AuthorUserID)
	require.Equal(t, res.Pulse.UID, reply.ParentUID)
	require.Equal(t, "Here's what I found.", reply.BodyText)

	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 2)

	// The API author hydration stamps a friendly name on assistant pulses
	// even though there's no user row behind the sentinel id.
	s.populateAuthorDisplay(ctx, page.Items)
	require.Equal(t, AssistantDisplayName, page.Items[1].AuthorName)
	require.Equal(t, AssistantLogin, page.Items[1].AuthorLogin)
}

func TestIntegrationAddAssistantReply_RejectsWhenDisabledOrEmpty(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	ctx := context.Background()
	s := newTestService(t)
	body := json.RawMessage(`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"q"}]}]}}`)
	res, err := s.CreateThread(ctx, CreateThreadCommand{
		OrgID: 1, AuthorUserID: 7, ResourceKind: ResourceKindDashboard, ResourceUID: "abc", Body: body,
	})
	require.NoError(t, err)

	// Toggle off → rejected, no reply posted.
	_, err = s.AddAssistantReply(ctx, AddAssistantReplyCommand{OrgID: 1, ThreadUID: res.Thread.UID, Markdown: "hi"})
	require.ErrorIs(t, err, ErrAssistantDisabled)

	// Toggle on but empty markdown → rejected.
	s.features = featuremgmt.WithFeatures(featuremgmt.FlagDashboardPulseAssistant)
	_, err = s.AddAssistantReply(ctx, AddAssistantReplyCommand{OrgID: 1, ThreadUID: res.Thread.UID, Markdown: "   "})
	require.ErrorIs(t, err, ErrEmptyBody)

	page, err := s.ListPulses(ctx, ListPulsesQuery{OrgID: 1, ThreadUID: res.Thread.UID})
	require.NoError(t, err)
	require.Len(t, page.Items, 1)
}
