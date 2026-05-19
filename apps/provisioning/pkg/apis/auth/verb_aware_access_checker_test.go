package auth

import (
	"context"
	"errors"
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestVerbAwareAccessChecker_DispatchesByVerb(t *testing.T) {
	tests := []struct {
		name         string
		verb         string
		expectReader bool
	}{
		{name: "get -> reader", verb: utils.VerbGet, expectReader: true},
		{name: "list -> reader", verb: utils.VerbList, expectReader: true},
		{name: "watch -> reader", verb: utils.VerbWatch, expectReader: true},
		{name: "create -> writer", verb: utils.VerbCreate, expectReader: false},
		{name: "update -> writer", verb: utils.VerbUpdate, expectReader: false},
		{name: "patch -> writer", verb: utils.VerbPatch, expectReader: false},
		{name: "delete -> writer", verb: utils.VerbDelete, expectReader: false},
		{name: "deletecollection -> writer", verb: utils.VerbDeleteCollection, expectReader: false},
		{name: "unknown verb -> writer (deny-by-default for safety)", verb: "weirdverb", expectReader: false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			readErr := errors.New("read called")
			writeErr := errors.New("write called")
			checker := NewVerbAwareAccessChecker(
				&recordingChecker{returnErr: readErr},
				&recordingChecker{returnErr: writeErr},
			)

			err := checker.Check(context.Background(), authlib.CheckRequest{Verb: tt.verb}, "")

			if tt.expectReader {
				assert.Same(t, readErr, err, "expected read checker to be called for verb %q", tt.verb)
			} else {
				assert.Same(t, writeErr, err, "expected write checker to be called for verb %q", tt.verb)
			}
		})
	}
}

func TestVerbAwareAccessChecker_PassesThroughAllowed(t *testing.T) {
	checker := NewVerbAwareAccessChecker(
		&recordingChecker{returnErr: nil}, // reader allows
		&recordingChecker{returnErr: errors.New("should not be called")},
	)

	require.NoError(t, checker.Check(context.Background(), authlib.CheckRequest{Verb: utils.VerbGet}, ""))
}

func TestVerbAwareAccessChecker_WithFallbackRoleIsNoOp(t *testing.T) {
	original := NewVerbAwareAccessChecker(
		&recordingChecker{},
		&recordingChecker{},
	)
	withFallback := original.WithFallbackRole(identity.RoleAdmin)

	assert.Same(t, original, withFallback,
		"WithFallbackRole on verb-aware checker must not produce a new instance — fallbacks are configured on the inner checkers")
}

// recordingChecker is a minimal AccessChecker that records whether it was
// invoked. Used to verify dispatch in TestVerbAwareAccessChecker_DispatchesByVerb.
type recordingChecker struct {
	returnErr error
}

func (r *recordingChecker) Check(_ context.Context, _ authlib.CheckRequest, _ string) error {
	return r.returnErr
}

func (r *recordingChecker) WithFallbackRole(_ identity.RoleType) AccessChecker {
	return r
}
