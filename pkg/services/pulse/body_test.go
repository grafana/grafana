package pulse

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

func TestParseAndValidateBody_AcceptsAllowedNodes(t *testing.T) {
	cases := []struct {
		name string
		raw  string
		want string // expected plain text
	}{
		{
			name: "single paragraph with text",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hello world"}]}]}}`,
			want: "hello world",
		},
		{
			name: "user mention",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"hi "},{"type":"mention","mention":{"kind":"user","targetId":"42","displayName":"alice"}}]}]}}`,
			want: "hi @alice",
		},
		{
			name: "panel mention",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"mention","mention":{"kind":"panel","targetId":"7","displayName":"CPU"}}]}]}}`,
			want: "#CPU",
		},
		{
			name: "https link is ok",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"link","url":"https://grafana.com","children":[{"type":"text","text":"docs"}]}]}]}}`,
			want: "docs",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			pb, err := ParseAndValidateBody(json.RawMessage(tc.raw))
			if err != nil {
				t.Fatalf("expected ok, got %v", err)
			}
			got := strings.TrimSpace(pb.Text)
			if got != tc.want {
				t.Fatalf("text mismatch: got %q want %q", got, tc.want)
			}
		})
	}
}

func TestParseAndValidateBody_RejectsScriptingNodes(t *testing.T) {
	// Each of these should be rejected; they cover the most common XSS
	// attack vectors that a malicious AST author might try.
	cases := []struct {
		name string
		raw  string
		want error
	}{
		{
			name: "script node",
			raw:  `{"root":{"type":"root","children":[{"type":"script","children":[{"type":"text","text":"alert(1)"}]}]}}`,
			want: ErrBodyDisallowedNode,
		},
		{
			name: "iframe node",
			raw:  `{"root":{"type":"root","children":[{"type":"iframe"}]}}`,
			want: ErrBodyDisallowedNode,
		},
		{
			name: "html node",
			raw:  `{"root":{"type":"root","children":[{"type":"html","text":"<svg onload=alert(1)>"}]}}`,
			want: ErrBodyDisallowedNode,
		},
		{
			name: "javascript link",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"link","url":"javascript:alert(1)","children":[{"type":"text","text":"x"}]}]}]}}`,
			want: ErrBodyInvalidLink,
		},
		{
			name: "data link",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"link","url":"data:text/html,<script>alert(1)</script>","children":[{"type":"text","text":"x"}]}]}]}}`,
			want: ErrBodyInvalidLink,
		},
		{
			name: "vbscript link",
			raw:  `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"link","url":"VBSCRIPT:alert(1)","children":[{"type":"text","text":"x"}]}]}]}}`,
			want: ErrBodyInvalidLink,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := ParseAndValidateBody(json.RawMessage(tc.raw))
			if err == nil {
				t.Fatalf("expected error %v, got nil", tc.want)
			}
			if !errors.Is(err, tc.want) {
				t.Fatalf("expected wrapped %v, got %v", tc.want, err)
			}
		})
	}
}

func TestParseAndValidateBody_RejectsEmptyAndOversize(t *testing.T) {
	if _, err := ParseAndValidateBody(nil); !errors.Is(err, ErrEmptyBody) {
		t.Fatalf("nil body: expected %v, got %v", ErrEmptyBody, err)
	}
	emptyBody := `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":""}]}]}}`
	if _, err := ParseAndValidateBody(json.RawMessage(emptyBody)); !errors.Is(err, ErrEmptyBody) {
		t.Fatalf("empty text body: expected %v, got %v", ErrEmptyBody, err)
	}

	huge := strings.Repeat("a", MaxBodyBytes+10)
	hugeBody := `{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"text","text":"` + huge + `"}]}]}}`
	if _, err := ParseAndValidateBody(json.RawMessage(hugeBody)); !errors.Is(err, ErrBodyTooLarge) {
		t.Fatalf("oversize body: expected %v, got %v", ErrBodyTooLarge, err)
	}
}

func TestParseAndValidateBody_RejectsInvalidMention(t *testing.T) {
	cases := []string{
		`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"mention"}]}]}}`,
		`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"mention","mention":{"kind":"weird","targetId":"x"}}]}]}}`,
		`{"root":{"type":"root","children":[{"type":"paragraph","children":[{"type":"mention","mention":{"kind":"user","targetId":""}}]}]}}`,
	}
	for i, c := range cases {
		_, err := ParseAndValidateBody(json.RawMessage(c))
		if !errors.Is(err, ErrBodyInvalidMention) {
			t.Fatalf("case %d: expected %v got %v", i, ErrBodyInvalidMention, err)
		}
	}
}

func TestParseAndValidateBody_DepthGuard(t *testing.T) {
	// Build deeply-nested paragraphs (paragraph is allowed, so this only
	// trips the depth guard).
	open := strings.Repeat(`{"type":"paragraph","children":[`, maxDepth+2)
	close := strings.Repeat(`]}`, maxDepth+2)
	raw := `{"root":{"type":"root","children":[` + strings.TrimSuffix(open, ",") + `{"type":"text","text":"x"}` + close + `]}}`
	if _, err := ParseAndValidateBody(json.RawMessage(raw)); !errors.Is(err, ErrInvalidBody) {
		t.Fatalf("depth guard: expected %v, got %v", ErrInvalidBody, err)
	}
}

func TestDedupeMentions(t *testing.T) {
	in := []Mention{
		{Kind: MentionKindUser, TargetID: "42"},
		{Kind: MentionKindUser, TargetID: "42"},
		{Kind: MentionKindPanel, TargetID: "7"},
		{Kind: MentionKindUser, TargetID: "42"},
		{Kind: MentionKindPanel, TargetID: "7"},
		{Kind: MentionKindUser, TargetID: "9"},
	}
	out := DedupeMentions(in)
	if len(out) != 3 {
		t.Fatalf("expected 3 unique, got %d: %v", len(out), out)
	}
}
