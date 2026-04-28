package pulse

import (
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
)

// MaxBodyBytes caps the size of a single pulse body to prevent storage abuse
// and to bound memory in clients rendering long threads. Tunable via INI
// later; 32 KiB matches the value set in the design doc.
const MaxBodyBytes = 32 * 1024

// allowedNodeTypes is the strict allowlist of Lexical node types that may
// appear in a pulse body. Validating the parsed AST against this allowlist
// is what lets the frontend render the body via React data bindings without
// dangerouslySetInnerHTML.
var allowedNodeTypes = map[string]bool{
	"root":      true,
	"paragraph": true,
	"text":      true,
	"mention":   true,
	"link":      true,
	"code":      true,
	"quote":     true,
	"linebreak": true,
}

// allowedURLSchemes lists URL schemes acceptable in `link` nodes. Anything
// else (notably javascript:, data:, vbscript:, file:) is rejected.
var allowedURLSchemes = map[string]bool{
	"http":   true,
	"https":  true,
	"mailto": true,
}

// ParsedBody is the result of validating + extracting metadata from a raw
// body JSON payload.
type ParsedBody struct {
	Body     Body
	Text     string
	Mentions []Mention
}

// ParseAndValidateBody decodes the raw JSON, walks the AST, enforces the
// allowlist, and extracts the plain-text preview and mentions in a single
// pass. The plain-text preview is used for notifications, search, and as a
// fallback for clients that cannot render the full AST.
func ParseAndValidateBody(raw json.RawMessage) (*ParsedBody, error) {
	if len(raw) == 0 {
		return nil, ErrEmptyBody
	}
	if len(raw) > MaxBodyBytes {
		return nil, ErrBodyTooLarge
	}

	var body Body
	if err := json.Unmarshal(raw, &body); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidBody, err)
	}

	pb := &ParsedBody{Body: body}
	if err := walkNode(body.Root, pb, 0); err != nil {
		return nil, err
	}

	pb.Text = strings.TrimSpace(pb.Text)
	if pb.Text == "" && len(pb.Mentions) == 0 {
		return nil, ErrEmptyBody
	}
	return pb, nil
}

// walkNode is a depth-first walk that validates every node and accumulates
// text + mentions into the ParsedBody. maxDepth guards against pathological
// nesting (e.g. an attacker sending a 10k-deep AST).
const maxDepth = 16

func walkNode(n BodyNode, pb *ParsedBody, depth int) error {
	if depth > maxDepth {
		return fmt.Errorf("%w: tree too deep", ErrInvalidBody)
	}
	if n.Type != "" && !allowedNodeTypes[n.Type] {
		return fmt.Errorf("%w: %s", ErrBodyDisallowedNode, n.Type)
	}

	switch n.Type {
	case "text":
		pb.Text += n.Text
	case "mention":
		if n.Mention == nil || !n.Mention.Kind.Valid() || n.Mention.TargetID == "" {
			return ErrBodyInvalidMention
		}
		pb.Mentions = append(pb.Mentions, *n.Mention)
		if n.Mention.DisplayName != "" {
			pb.Text += "@" + n.Mention.DisplayName
		} else {
			pb.Text += "@" + string(n.Mention.Kind) + ":" + n.Mention.TargetID
		}
	case "link":
		if n.URL == "" {
			return fmt.Errorf("%w: empty link href", ErrBodyInvalidLink)
		}
		if err := validateURL(n.URL); err != nil {
			return err
		}
	case "linebreak":
		pb.Text += "\n"
	}

	for _, c := range n.Children {
		if err := walkNode(c, pb, depth+1); err != nil {
			return err
		}
	}

	if n.Type == "paragraph" || n.Type == "quote" {
		pb.Text += "\n"
	}
	return nil
}

// validateURL parses the URL and rejects any scheme outside the allowlist.
// We use net/url here (instead of string concatenation) to catch tricks
// like "  javascript:alert(1)" or "JaVaScRiPt:alert(1)".
func validateURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return fmt.Errorf("%w: %v", ErrBodyInvalidLink, err)
	}
	scheme := strings.ToLower(u.Scheme)
	if scheme == "" {
		return fmt.Errorf("%w: relative URLs are not allowed", ErrBodyInvalidLink)
	}
	if !allowedURLSchemes[scheme] {
		return fmt.Errorf("%w: scheme %q", ErrBodyInvalidLink, scheme)
	}
	return nil
}

// DedupeMentions removes duplicate mentions of the same target, preserving
// first-seen order. Used before fanning out notifications so that a body
// containing "@alice @alice" only notifies alice once.
func DedupeMentions(mentions []Mention) []Mention {
	seen := make(map[string]bool, len(mentions))
	out := make([]Mention, 0, len(mentions))
	for _, m := range mentions {
		key := string(m.Kind) + "|" + m.TargetID
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, m)
	}
	return out
}
