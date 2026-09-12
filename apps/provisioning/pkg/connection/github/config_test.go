package github

import (
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/stretchr/testify/require"
)

func TestConfigCustomServerURL(t *testing.T) {
	conn := &provisioning.Connection{
		Spec: provisioning.ConnectionSpec{
			GitHub: &provisioning.GitHubConnectionConfig{
				ServerURL: "https://ghes.example.com",
			},
		},
	}

	require.Equal(t, "https://ghes.example.com", (config{obj: conn}).CustomServerURL())
}
