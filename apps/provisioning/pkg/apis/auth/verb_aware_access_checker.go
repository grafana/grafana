package auth

import (
	"context"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// verbAwareAccessChecker dispatches Check to a read or a write AccessChecker
// based on the request verb. It exists so a single endpoint that handles both
// read and write verbs (e.g. the files subresource) can apply different role
// fallbacks per operation: a reader fallback for get/list/watch and a writer
// fallback for everything else.
type verbAwareAccessChecker struct {
	read  AccessChecker
	write AccessChecker
}

// NewVerbAwareAccessChecker composes a read checker and a write checker into
// a single AccessChecker. The inner checkers are expected to already carry
// any desired fallback roles (e.g. accessWithViewer / accessWithEditor) —
// this wrapper does not configure fallbacks itself.
func NewVerbAwareAccessChecker(read, write AccessChecker) AccessChecker {
	return &verbAwareAccessChecker{read: read, write: write}
}

// WithFallbackRole is intentionally a no-op. Per-verb fallbacks are decided at
// construction by the caller; applying a single role across both inner checkers
// would defeat the purpose of the split.
func (c *verbAwareAccessChecker) WithFallbackRole(_ identity.RoleType) AccessChecker {
	return c
}

// Check dispatches to the read or write checker based on req.Verb.
func (c *verbAwareAccessChecker) Check(ctx context.Context, req authlib.CheckRequest, folder string) error {
	if isReadVerb(req.Verb) {
		return c.read.Check(ctx, req, folder)
	}
	return c.write.Check(ctx, req, folder)
}

func isReadVerb(verb string) bool {
	switch verb {
	case utils.VerbGet, utils.VerbList, utils.VerbWatch:
		return true
	default:
		return false
	}
}
