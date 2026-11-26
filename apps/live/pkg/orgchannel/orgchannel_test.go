package orgchannel

import (
	"testing"

	authlib "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func TestStripK8sNamespace(t *testing.T) {
	channelID := "stream"
	_, _, err := StripK8sNamespace(channelID)
	require.Error(t, err)

	channelID = "plugin/testdata/random-20Hz-stream"
	_, _, err = StripK8sNamespace(channelID)
	require.Error(t, err)

	channelID = "org-123/plugin/testdata/random-20Hz-stream"
	ns, channel, err := StripK8sNamespace(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(123), ns.OrgID)
	require.Equal(t, "plugin/testdata/random-20Hz-stream", channel)

	// Legacy bare numeric org ID format (backwards compatibility).
	// Value is normalized to canonical k8s namespace.
	channelID = "1/grafana/dashboard/uid/abc123"
	ns, channel, err = StripK8sNamespace(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(1), ns.OrgID)
	require.Equal(t, "default", ns.Value)
	require.Equal(t, "grafana/dashboard/uid/abc123", channel)

	channelID = "42/plugin/testdata/random-20Hz-stream"
	ns, channel, err = StripK8sNamespace(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(42), ns.OrgID)
	require.Equal(t, "org-42", ns.Value)
	require.Equal(t, "plugin/testdata/random-20Hz-stream", channel)

	// Invalid bare numeric org ID (zero or negative)
	channelID = "0/grafana/dashboard/uid/abc123"
	_, _, err = StripK8sNamespace(channelID)
	require.Error(t, err)

	channelID = "-1/grafana/dashboard/uid/abc123"
	_, _, err = StripK8sNamespace(channelID)
	require.Error(t, err)
}

func TestUserID(t *testing.T) {
	tests := []struct {
		name     string
		user     *identity.StaticRequester
		expected string
	}{
		{
			name:     "user in a stack",
			user:     &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "u-abc", Namespace: "stacks-123"},
			expected: "stacks-123/user:u-abc",
		},
		{
			name:     "service account in an org",
			user:     &identity.StaticRequester{Type: authlib.TypeServiceAccount, UserUID: "sa-1", Namespace: "default"},
			expected: "default/service-account:sa-1",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.expected, UserID(tt.user))
		})
	}

	// The same user identifier in two namespaces must not collide.
	a := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "1", Namespace: "stacks-1"}
	b := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: "1", Namespace: "stacks-2"}
	require.NotEqual(t, UserID(a), UserID(b))
}

func TestPrependOrgID(t *testing.T) {
	channel := "plugin/testdata/random-20Hz-stream"
	channelID := PrependK8sNamespace("org-2", channel)
	require.Equal(t, "org-2/plugin/testdata/random-20Hz-stream", channelID)
}
