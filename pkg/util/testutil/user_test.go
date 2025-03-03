package testutil

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func TestSignedInUser(t *testing.T) {
	t.Parallel()

	r := func(user *user.SignedInUser, err error) {
		require.NotNil(t, user)
		require.NoError(t, err)
	}

	r(SignedInUser{}.NewAnonymous())
	r(SignedInUser{}.NewEditor())
	r(SignedInUser{}.NewGrafanaAdmin())
	r(SignedInUser{}.NewEmpty())
	r(SignedInUser{}.NewServiceAccount())
	r(SignedInUser{}.NewViewer())

	user, err := readUser(`non existent!!!`)
	require.Nil(t, user)
	require.Error(t, err)
}
