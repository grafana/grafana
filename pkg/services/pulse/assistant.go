package pulse

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

// Assistant identity. The assistant authors its replies as a synthetic
// service account rather than a real Grafana user, so we reserve a
// negative sentinel id that can never collide with a row in the user
// table (ids are positive). Read-side hydration (populateAuthorDisplay)
// special-cases this id to render a friendly "Grafana Assistant" label,
// and the participant rollup query (author_user_id > 0) naturally
// excludes it so the assistant never shows up in the Users filter.
const (
	// AssistantAuthorUserID is the author id stamped on assistant replies.
	AssistantAuthorUserID int64 = -1
	// AssistantMentionTarget is the fixed TargetID an `@assistant` chip
	// carries. There is only ever one assistant per instance, so the
	// target is a constant rather than a looked-up id.
	AssistantMentionTarget = "assistant"
	// AssistantDisplayName / AssistantLogin are the display fields the
	// API stamps onto assistant-authored pulses so the thread renders a
	// recognizable name without a user lookup.
	AssistantDisplayName = "Grafana Assistant"
	AssistantLogin       = "grafana-assistant"
)

// assistantReplyTimeout bounds a single responder invocation. The reply
// runs detached from the originating HTTP request (the user shouldn't
// wait on the assistant), so it needs its own deadline to avoid a stuck
// responder leaking a goroutine.
const assistantReplyTimeout = 60 * time.Second

// AssistantRequest is the context handed to an AssistantResponder when a
// user tags `@assistant` in a pulse. It carries everything a responder
// needs to generate a contextual reply without reaching back into the
// pulse store itself.
type AssistantRequest struct {
	OrgID        int64
	ResourceKind ResourceKind
	ResourceUID  string
	ThreadUID    string
	ThreadTitle  string
	// PulseUID is the pulse that mentioned the assistant; a responder may
	// reply to it directly so the answer threads under the question.
	PulseUID string
	// PromptText is the plain-text body of the triggering pulse — i.e.
	// what the user actually wrote alongside the `@assistant` tag.
	PromptText string
	// AuthorUserID is the user who tagged the assistant, for audit/logging.
	AuthorUserID int64
}

// AssistantReply is what a responder returns. Markdown is rendered through
// the same sanitizer pipeline every other pulse body uses. An empty
// Markdown means "no reply" — the service posts nothing.
type AssistantReply struct {
	Markdown string
}

// AssistantResponder generates the Grafana Assistant's reply to a pulse
// that tagged it. The OSS default (StubAssistantResponder) has no model
// behind it; a real LLM-backed responder is layered in via
// PulseService.SetAssistantResponder, mirroring how SetNotifier swaps in
// real email/webhook delivery.
type AssistantResponder interface {
	Respond(ctx context.Context, req AssistantRequest) (AssistantReply, error)
}

// StubAssistantResponder is the v1 default. There is no language model in
// OSS Grafana, so it posts a deterministic acknowledgement that proves the
// tag → reply path end-to-end (the reply appears in-thread, authored by the
// assistant service account) and tells the operator how to enable real
// answers. It echoes a short slice of the prompt so it's visible that the
// user's text reached the responder.
type StubAssistantResponder struct {
	Log log.Logger
}

func (r *StubAssistantResponder) Respond(_ context.Context, req AssistantRequest) (AssistantReply, error) {
	if r.Log != nil {
		r.Log.Info("pulse assistant tagged (stub responder)",
			"orgId", req.OrgID,
			"threadUID", req.ThreadUID,
			"pulseUID", req.PulseUID,
			"authorUserID", req.AuthorUserID,
		)
	}
	var b strings.Builder
	b.WriteString("Hi — I'm the **Grafana Assistant**. ")
	if q := truncate(strings.TrimSpace(req.PromptText), 200); q != "" {
		b.WriteString("You asked: \"")
		b.WriteString(q)
		b.WriteString("\". ")
	}
	b.WriteString("No assistant model is configured in this Grafana instance, so I can't answer fully yet. ")
	b.WriteString("An administrator can connect an assistant backend to enable AI replies.")
	return AssistantReply{Markdown: b.String()}, nil
}

// buildAssistantResponder picks the responder wired at construction time.
// Today this is always the stub; a real responder replaces it later via
// SetAssistantResponder. Kept as a seam so wiring stays symmetric with
// buildNotifier.
func buildAssistantResponder(logger log.Logger) AssistantResponder {
	return &StubAssistantResponder{Log: logger}
}

// hasAssistantMention reports whether any mention in the (already
// deduped) set tags the assistant.
func hasAssistantMention(mentions []Mention) bool {
	for _, m := range mentions {
		if m.Kind == MentionKindAssistant {
			return true
		}
	}
	return false
}

// buildAssistantReplyBody wraps the responder's markdown into the body
// envelope the rest of the pipeline expects (a single paragraph plus the
// markdown source). ParseAndValidateBody prefers the markdown field for
// the text projection, so body_text comes out as the markdown verbatim.
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

// SetAssistantResponder swaps the assistant responder after construction.
// Mirrors SetNotifier: wire (or enterprise) calls this to layer in a real
// LLM-backed responder over the OSS stub. A nil responder is ignored so a
// misconfigured provider can't silently disable the stub.
func (s *PulseService) SetAssistantResponder(r AssistantResponder) {
	if r != nil {
		s.assistantResponder = r
	}
}

// maybeRespondAsAssistant kicks off an assistant reply when a user's pulse
// tags `@assistant`. It is a no-op unless:
//   - the dashboardPulseAssistant toggle is on,
//   - a responder is configured,
//   - the triggering pulse was authored by a human (AuthorKindUser) — this
//     is the reentrancy guard: the assistant's own reply is a
//     service-account pulse, so it can never trigger another reply, and
//   - the body actually contains an assistant mention.
//
// The reply is dispatched on a detached, time-bounded context so the user's
// POST returns immediately; a slow model never blocks the request. The
// reply surfaces in the thread via the normal live event / poll path.
func (s *PulseService) maybeRespondAsAssistant(thread Thread, pulse Pulse, mentions []Mention) {
	if !s.assistantEnabled() || pulse.AuthorKind != AuthorKindUser || !hasAssistantMention(mentions) {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), assistantReplyTimeout)
		defer cancel()
		s.respondAsAssistant(ctx, thread, pulse)
	}()
}

// assistantEnabled gates assistant replies on the feature toggle and a
// configured responder. Split out so the (nil-features) test service and
// the gate are easy to reason about.
func (s *PulseService) assistantEnabled() bool {
	if s.assistantResponder == nil || s.features == nil {
		return false
	}
	//nolint:staticcheck // not yet migrated to OpenFeature
	return s.features.IsEnabled(context.Background(), featuremgmt.FlagDashboardPulseAssistant)
}

// respondAsAssistant asks the responder for a reply and posts it back into
// the thread as the assistant service account. Exported failures degrade to
// a logged warning — a failed assistant reply must never corrupt the
// originating thread. Synchronous and side-effecting; tests call it directly
// to avoid goroutine races.
func (s *PulseService) respondAsAssistant(ctx context.Context, thread Thread, trigger Pulse) {
	if s.assistantResponder == nil {
		return
	}
	reply, err := s.assistantResponder.Respond(ctx, AssistantRequest{
		OrgID:        thread.OrgID,
		ResourceKind: thread.ResourceKind,
		ResourceUID:  thread.ResourceUID,
		ThreadUID:    thread.UID,
		ThreadTitle:  thread.Title,
		PulseUID:     trigger.UID,
		PromptText:   trigger.BodyText,
		AuthorUserID: trigger.AuthorUserID,
	})
	if err != nil {
		s.log.Warn("pulse assistant responder failed", "err", err, "threadUID", thread.UID, "pulseUID", trigger.UID)
		return
	}
	if strings.TrimSpace(reply.Markdown) == "" {
		return
	}
	body, err := buildAssistantReplyBody(reply.Markdown)
	if err != nil {
		s.log.Warn("pulse assistant reply body marshal failed", "err", err, "threadUID", thread.UID)
		return
	}
	if _, err := s.AddPulse(ctx, AddPulseCommand{
		OrgID:        thread.OrgID,
		ThreadUID:    thread.UID,
		ParentUID:    trigger.UID,
		AuthorUserID: AssistantAuthorUserID,
		AuthorKind:   AuthorKindServiceAccount,
		Body:         body,
	}); err != nil {
		s.log.Warn("pulse assistant reply post failed", "err", err, "threadUID", thread.UID)
	}
}
