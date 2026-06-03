package pulse

import (
	"context"
	"encoding/json"
	"strings"

	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Assistant identity. The Grafana Assistant authors its replies as a
// synthetic service account rather than a real Grafana user, so we reserve
// a negative sentinel id that can never collide with a row in the user
// table (ids are positive). Read-side hydration (populateAuthorDisplay)
// special-cases this id to render a friendly "Grafana Assistant" label,
// and the participant rollup query (author_user_id > 0) naturally excludes
// it so the assistant never shows up in the Users filter.
const (
	// AssistantAuthorUserID is the author id stamped on assistant replies.
	AssistantAuthorUserID int64 = -1
	// AssistantMentionTarget is the fixed TargetID an `@assistant` chip
	// carries. There is only ever one assistant per instance, so the
	// target is a constant rather than a looked-up id.
	AssistantMentionTarget = "assistant"
	// AssistantDisplayName / AssistantLogin are the display fields stamped
	// onto assistant-authored pulses so the thread renders a recognizable
	// name without a user lookup.
	AssistantDisplayName = "Grafana Assistant"
	AssistantLogin       = "grafana-assistant"
)

// assistantEnabled reports whether the Grafana Assistant integration is on
// for this instance. The reply text itself is generated client-side by the
// Grafana Assistant (the backend has no LLM); this flag only governs whether
// the assistant-reply persist path is reachable.
func (s *PulseService) assistantEnabled() bool {
	if s.features == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return s.features.IsEnabled(context.Background(), featuremgmt.FlagDashboardPulseAssistant)
}

// AddAssistantReply persists a Grafana Assistant reply into a thread,
// authored under the assistant service account. The reply markdown is
// generated client-side (the browser's Grafana Assistant produces the text
// and POSTs it here) — the backend has no model of its own, so this method
// only validates and stores the reply under the assistant identity. It
// reuses AddPulse so the reply gets the same closed-thread guard, live
// event, subscription fan-out, and version bump as any other pulse.
func (s *PulseService) AddAssistantReply(ctx context.Context, cmd AddAssistantReplyCommand) (Pulse, error) {
	if !s.assistantEnabled() {
		return Pulse{}, ErrAssistantDisabled
	}
	markdown := strings.TrimSpace(cmd.Markdown)
	if markdown == "" {
		return Pulse{}, ErrEmptyBody
	}
	body, err := buildAssistantReplyBody(markdown)
	if err != nil {
		return Pulse{}, err
	}
	return s.AddPulse(ctx, AddPulseCommand{
		OrgID:        cmd.OrgID,
		ThreadUID:    cmd.ThreadUID,
		ParentUID:    cmd.ParentUID,
		AuthorUserID: AssistantAuthorUserID,
		AuthorKind:   AuthorKindServiceAccount,
		Body:         body,
	})
}

// buildAssistantReplyBody wraps the client-generated markdown into the body
// envelope the rest of the pipeline expects (a single paragraph plus the
// markdown source). ParseAndValidateBody prefers the markdown field for the
// text projection, so body_text comes out as the markdown verbatim.
func buildAssistantReplyBody(markdown string) (json.RawMessage, error) {
	body := Body{
		Root: BodyNode{
			Type: "root",
			Children: []BodyNode{{
				Type:     "paragraph",
				Children: []BodyNode{{Type: "text", Text: markdown}},
			}},
		},
		Markdown: markdown,
	}
	return json.Marshal(body)
}
