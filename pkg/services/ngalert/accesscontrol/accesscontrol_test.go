package accesscontrol

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
)

func TestHasAccessOrError(t *testing.T) {
	t.Run("returns nil when user has access", func(t *testing.T) {
		svc := genericService{ac: &actest.FakeAccessControl{ExpectedEvaluate: true}}
		err := svc.HasAccessOrError(context.Background(), &identity.StaticRequester{}, accesscontrol.EvalPermission("test:action"), func() string { return "test action" })
		require.NoError(t, err)
	})

	t.Run("returns errutil.Forbidden when user lacks access", func(t *testing.T) {
		svc := genericService{ac: &actest.FakeAccessControl{ExpectedEvaluate: false}}
		err := svc.HasAccessOrError(context.Background(), &identity.StaticRequester{}, accesscontrol.EvalPermission("test:action"), func() string { return "test action" })
		require.Error(t, err)

		var grafanaErr errutil.Error
		require.True(t, errors.As(err, &grafanaErr), "expected errutil.Error, got %T", err)
		assert.Equal(t, 403, grafanaErr.Reason.Status().HTTPStatus())
	})

	t.Run("wraps internal evaluation error as errutil.Error", func(t *testing.T) {
		internalErr := errors.New("scope resolution failed")
		svc := genericService{ac: &actest.FakeAccessControl{ExpectedErr: internalErr}}
		err := svc.HasAccessOrError(context.Background(), &identity.StaticRequester{}, accesscontrol.EvalPermission("test:action"), func() string { return "test action" })
		require.Error(t, err)

		// The wrapped error should be detectable as errutil.Error by ErrOrFallback
		var grafanaErr errutil.Error
		require.True(t, errors.As(err, &grafanaErr), "expected errutil.Error in chain, got %T: %v", err, err)
		assert.Equal(t, 403, grafanaErr.Reason.Status().HTTPStatus())

		// The original internal error should also be in the chain
		require.True(t, errors.Is(err, internalErr), "expected original error in chain")
	})
}
