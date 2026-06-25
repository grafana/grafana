package pulse

import (
	"context"
	"net/url"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/util"
)

// hookNameMaxLen mirrors the pulse_hook.name column width (190) so a
// name that would be silently truncated by the DB is rejected up-front
// with a clear error instead.
const hookNameMaxLen = 190

// CreateHook validates and persists a new named hook.
func (s *PulseService) CreateHook(ctx context.Context, cmd CreateHookCommand) (Hook, error) {
	name, typ, rawURL, err := validateHookFields(cmd.Name, cmd.Type, cmd.URL)
	if err != nil {
		return Hook{}, err
	}
	now := time.Now().UTC()
	h := &Hook{
		UID:       util.GenerateShortUID(),
		OrgID:     cmd.OrgID,
		Name:      name,
		Type:      typ,
		URL:       rawURL,
		Secret:    cmd.Secret,
		Disabled:  cmd.Disabled,
		CreatedBy: cmd.CreatedBy,
		Created:   now,
		Updated:   now,
	}
	if err := s.hookStore.insertHook(ctx, h); err != nil {
		return Hook{}, err
	}
	return *h, nil
}

// UpdateHook validates and applies an update. A nil Secret preserves
// the stored secret; a non-nil pointer overwrites it.
func (s *PulseService) UpdateHook(ctx context.Context, cmd UpdateHookCommand) (Hook, error) {
	name, typ, rawURL, err := validateHookFields(cmd.Name, cmd.Type, cmd.URL)
	if err != nil {
		return Hook{}, err
	}
	var secret *string
	if cmd.Secret != nil {
		trimmed := strings.TrimSpace(*cmd.Secret)
		secret = &trimmed
	}
	return s.hookStore.updateHook(ctx, cmd.OrgID, cmd.UID, name, typ, rawURL, cmd.Disabled, secret)
}

func (s *PulseService) DeleteHook(ctx context.Context, cmd DeleteHookCommand) error {
	return s.hookStore.deleteHook(ctx, cmd.OrgID, cmd.UID)
}

func (s *PulseService) GetHook(ctx context.Context, orgID int64, uid string) (Hook, error) {
	return s.hookStore.getHookByUID(ctx, orgID, uid)
}

func (s *PulseService) ListHooks(ctx context.Context, q ListHooksQuery) ([]Hook, error) {
	return s.hookStore.listHooks(ctx, q.OrgID)
}

// ListMentionableHooks returns the enabled hooks that match the picker
// query, capped, projected to the minimal mention-hit shape.
func (s *PulseService) ListMentionableHooks(ctx context.Context, q MentionableHooksQuery) ([]HookMentionHit, error) {
	hooks, err := s.hookStore.listMentionableHooks(ctx, q)
	if err != nil {
		return nil, err
	}
	out := make([]HookMentionHit, 0, len(hooks))
	for _, h := range hooks {
		out = append(out, HookMentionHit{UID: h.UID, Name: h.Name, Type: h.Type})
	}
	return out, nil
}

// validateHookFields normalizes and validates the user-supplied parts
// of a hook. Returns the cleaned (name, type, url) on success.
//
// URL validation rejects anything that isn't an absolute http(s) URL.
// We deliberately allow arbitrary hosts (the whole point is to reach an
// external service, same as alerting webhooks); SSRF posture is the
// admin's responsibility, gated behind pulse:admin.
func validateHookFields(rawName string, rawType HookType, rawURL string) (string, HookType, string, error) {
	name := strings.TrimSpace(rawName)
	if name == "" {
		return "", "", "", ErrHookNameRequired
	}
	if len(name) > hookNameMaxLen {
		return "", "", "", ErrHookNameTooLong
	}
	typ := rawType
	if typ == "" {
		typ = HookTypeWebhook
	}
	if !typ.Valid() {
		return "", "", "", ErrHookInvalidType
	}
	u := strings.TrimSpace(rawURL)
	parsed, err := url.Parse(u)
	if err != nil {
		return "", "", "", ErrHookInvalidURL
	}
	scheme := strings.ToLower(parsed.Scheme)
	if (scheme != "http" && scheme != "https") || parsed.Host == "" {
		return "", "", "", ErrHookInvalidURL
	}
	return name, typ, u, nil
}

// collectHookMentionUIDs extracts the UIDs of every named hook mention
// in a set, deduped and order-preserving. Returns nil when no hook
// mentions are present so the dispatcher can cheaply short-circuit.
func collectHookMentionUIDs(mentions []Mention) []string {
	var out []string
	seen := make(map[string]struct{})
	for _, m := range mentions {
		if m.Kind != MentionKindWebhook {
			continue
		}
		uid := strings.TrimSpace(m.TargetID)
		if uid == "" {
			continue
		}
		if _, ok := seen[uid]; ok {
			continue
		}
		seen[uid] = struct{}{}
		out = append(out, uid)
	}
	return out
}
