package display

import (
	"testing"

	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
)

func TestParseKeys(t *testing.T) {
	t.Run("empty input returns empty result", func(t *testing.T) {
		got := parseKeys(nil)
		require.Empty(t, got.uids)
		require.Empty(t, got.ids)
		require.Empty(t, got.invalid)
		require.Empty(t, got.disp)
	})

	t.Run("plain numeric key is treated as an internal user ID", func(t *testing.T) {
		got := parseKeys([]string{"42"})
		require.Equal(t, []int64{42}, got.ids)
		require.Empty(t, got.uids)
		require.Empty(t, got.disp)
		require.Empty(t, got.invalid)
	})

	t.Run("plain non-numeric key is treated as a user UID", func(t *testing.T) {
		got := parseKeys([]string{"abc-123"})
		require.Equal(t, []string{"abc-123"}, got.uids)
		require.Empty(t, got.ids)
		require.Empty(t, got.disp)
		require.Empty(t, got.invalid)
	})

	t.Run("plain zero key resolves to the System admin display", func(t *testing.T) {
		got := parseKeys([]string{"0"})
		require.Empty(t, got.ids)
		require.Empty(t, got.uids)
		require.Len(t, got.disp, 1)
		require.Equal(t, "System admin", got.disp[0].DisplayName)
		require.Equal(t, authlib.TypeUser, got.disp[0].Identity.Type)
		require.Equal(t, "0", got.disp[0].Identity.Name)
	})

	t.Run("user prefix strips the type and parses the remainder", func(t *testing.T) {
		got := parseKeys([]string{"user:7", "user:some-uid"})
		require.Equal(t, []int64{7}, got.ids)
		require.Equal(t, []string{"some-uid"}, got.uids)
		require.Empty(t, got.disp)
		require.Empty(t, got.invalid)
	})

	t.Run("anonymous prefix produces a terminal display entry", func(t *testing.T) {
		got := parseKeys([]string{"anonymous:"})
		require.Empty(t, got.ids)
		require.Empty(t, got.uids)
		require.Empty(t, got.invalid)
		require.Equal(t, []iam.Display{{
			Identity:    iam.IdentityRef{Type: authlib.TypeAnonymous},
			DisplayName: "Anonymous",
			AvatarURL:   got.disp[0].AvatarURL,
		}}, got.disp)
		require.NotEmpty(t, got.disp[0].AvatarURL)
	})

	t.Run("api-key prefix produces a terminal display entry carrying the name", func(t *testing.T) {
		got := parseKeys([]string{"api-key:abc"})
		require.Empty(t, got.ids)
		require.Empty(t, got.uids)
		require.Empty(t, got.invalid)
		require.Len(t, got.disp, 1)
		require.Equal(t, "API Key", got.disp[0].DisplayName)
		require.Equal(t, authlib.TypeAPIKey, got.disp[0].Identity.Type)
		require.Equal(t, "abc", got.disp[0].Identity.Name)
	})

	t.Run("provisioning prefix is currently treated as invalid because authlib.ParseType does not recognize it", func(t *testing.T) {
		// NOTE: parseKeys has a case for authlib.TypeProvisioning, but authlib.ParseType
		// does not return TypeProvisioning, so that branch is unreachable today and the
		// key falls into `invalid`.
		got := parseKeys([]string{"provisioning:anything"})
		require.Equal(t, []string{"provisioning:anything"}, got.invalid)
		require.Empty(t, got.ids)
		require.Empty(t, got.uids)
		require.Empty(t, got.disp)
	})

	t.Run("unknown type prefix is recorded as invalid", func(t *testing.T) {
		got := parseKeys([]string{"bogus:1"})
		require.Equal(t, []string{"bogus:1"}, got.invalid)
		require.Empty(t, got.ids)
		require.Empty(t, got.uids)
		require.Empty(t, got.disp)
	})

	t.Run("mixed input is bucketed across all fields and the original keys are preserved", func(t *testing.T) {
		input := []string{
			"42",
			"user:7",
			"some-uid",
			"user:other-uid",
			"0",
			"anonymous:",
			"api-key:k1",
			"provisioning:",
			"bogus:1",
		}
		got := parseKeys(input)

		require.Equal(t, input, got.keys, "original keys should round-trip")
		require.Equal(t, []int64{42, 7}, got.ids)
		require.Equal(t, []string{"some-uid", "other-uid"}, got.uids)
		require.Equal(t, []string{"provisioning:", "bogus:1"}, got.invalid)
		require.Len(t, got.disp, 3, "0, anonymous, and api-key each yield a terminal display")
	})
}
