package manager

import (
	"context"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/services/secrets"
	"github.com/grafana/grafana/pkg/services/secrets/database"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestSecretsServiceGetDecryptedValueResolvesSecretReferences(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	testDB := db.InitTestDB(t) //nolint:staticcheck // legacy shared-DB test setup; migrate to NewTestStore
	store := database.ProvideSecretsStore(testDB)
	svc := SetupTestService(t, store)
	ctx := context.Background()

	t.Run("env reference", func(t *testing.T) {
		t.Setenv("GRAFANA_CONTACT_POINT_SECRET", "resolved-secret")

		encrypted, err := svc.Encrypt(ctx, []byte("$__env{GRAFANA_CONTACT_POINT_SECRET}"), secrets.WithoutScope())
		require.NoError(t, err)

		got := svc.GetDecryptedValue(ctx, map[string][]byte{"secret": encrypted}, "secret", "fallback")
		require.Equal(t, "resolved-secret", got)
	})

	t.Run("file reference", func(t *testing.T) {
		path := t.TempDir() + "/contact-point-secret"
		require.NoError(t, os.WriteFile(path, []byte("file-secret"), 0600))

		encrypted, err := svc.Encrypt(ctx, []byte("$__file{"+path+"}"), secrets.WithoutScope())
		require.NoError(t, err)

		got := svc.GetDecryptedValue(ctx, map[string][]byte{"secret": encrypted}, "secret", "fallback")
		require.Equal(t, "file-secret", got)
	})

	t.Run("ordinary secret pattern is unchanged", func(t *testing.T) {
		encrypted, err := svc.Encrypt(ctx, []byte("password-${VAR}"), secrets.WithoutScope())
		require.NoError(t, err)

		got := svc.GetDecryptedValue(ctx, map[string][]byte{"secret": encrypted}, "secret", "fallback")
		require.Equal(t, "password-${VAR}", got)
	})
}
