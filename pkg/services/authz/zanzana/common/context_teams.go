package common

import (
	"context"
	"strings"
)

// ParseTeamGroup returns (name, true) for values with prefix "team:" and a non-empty
// name (e.g. "team:123" -> "123", true).
func ParseTeamGroup(s string) (name string, ok bool) {
	if !strings.HasPrefix(s, TypeTeamPrefix) {
		return "", false
	}
	n := strings.TrimPrefix(s, TypeTeamPrefix)
	if n == "" {
		return "", false
	}
	return n, true
}

// contextKeyTeams is the context key for [ContextWithTeams] / [TeamsFromContext].
type contextKeyTeams struct{}

// ContextWithTeams associates team identifiers with the current request context
// (embedded mode, tests) when AuthInfo is not derived from a JWT. Each entry
// must be a full team object id, e.g. "team:123" (same prefix as [TypeTeamPrefix]).
func ContextWithTeams(ctx context.Context, teams []string) context.Context {
	if len(teams) == 0 {
		return ctx
	}
	return context.WithValue(ctx, contextKeyTeams{}, teams)
}

// TeamsFromContext returns team ids from [ContextWithTeams], or nil if none.
func TeamsFromContext(ctx context.Context) []string {
	v, _ := ctx.Value(contextKeyTeams{}).([]string)
	return v
}
