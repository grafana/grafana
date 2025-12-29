package connection_test

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestMutateConnection(t *testing.T) {
	t.Run("should add URL to Github connection", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Name: "test-private-key",
				},
			},
		}

		require.NoError(t, connection.MutateConnection(c))
		assert.Equal(t, "https://github.com/settings/installations/456", c.Spec.URL)
	})
}
