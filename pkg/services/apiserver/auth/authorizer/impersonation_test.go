package authorizer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apiserver/pkg/authorization/authorizer"
)

func TestImpersonationAuthorizer_Authorize(t *testing.T) {
	auth := impersonationAuthorizer{}

	t.Run("impersonate verb", func(t *testing.T) {
		attrs := &fakeAttributes{
			verb: "impersonate",
		}

		authorized, reason, err := auth.Authorize(context.Background(), attrs)

		require.Equal(t, authorizer.DecisionDeny, authorized)
		require.Equal(t, "user impersonation is not supported", reason)
		require.NoError(t, err)
	})

	t.Run("other verb", func(t *testing.T) {
		attrs := &fakeAttributes{
			verb: "get",
		}

		authorized, reason, err := auth.Authorize(context.Background(), attrs)

		require.Equal(t, authorizer.DecisionNoOpinion, authorized)
		require.Equal(t, "", reason)
		require.NoError(t, err)
	})
}

type fakeAttributes struct {
	authorizer.Attributes
	verb string
}

func (a fakeAttributes) GetVerb() string {
	return a.verb
}
