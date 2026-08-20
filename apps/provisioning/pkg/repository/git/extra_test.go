package git

import (
	"context"
	"net/http"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/require"
)

type emptySecureValues struct{}

func (emptySecureValues) Token(context.Context) (common.RawSecureValue, error) {
	return "", nil
}

func (emptySecureValues) WebhookSecret(context.Context) (common.RawSecureValue, error) {
	return "", nil
}

func (emptySecureValues) CommitSigningKey(context.Context) (common.RawSecureValue, error) {
	return "", nil
}

func TestExtraBuildConfiguresRequestLimitsPerRepository(t *testing.T) {
	decrypter := func(*provisioning.Repository) repository.SecureValues {
		return emptySecureValues{}
	}
	builder := Extra(decrypter, false)

	build := func(name string, limits *provisioning.GitRequestLimits) *gitRepository {
		t.Helper()

		built, err := builder.Build(context.Background(), &provisioning.Repository{
			Spec: provisioning.RepositorySpec{
				Type: provisioning.GitRepositoryType,
				Git: &provisioning.GitRepositoryConfig{
					URL:           "https://git.example.com/" + name,
					Branch:        "main",
					RequestLimits: limits,
				},
			},
		})
		require.NoError(t, err)

		result, ok := built.(*gitRepository)
		require.True(t, ok)
		return result
	}

	unlimited := build("unlimited", nil)
	require.Nil(t, unlimited.gitConfig.HTTPClient)

	zeroLimits := build("zero-limits", &provisioning.GitRequestLimits{})
	require.Nil(t, zeroLimits.gitConfig.HTTPClient)

	limits := &provisioning.GitRequestLimits{
		MaxConcurrent:     2,
		RequestsPerSecond: 5,
		Burst:             3,
	}
	first := build("first", limits)
	second := build("second", limits)

	firstTransport, ok := first.gitConfig.HTTPClient.Transport.(*hostLimitTransport)
	require.True(t, ok)
	require.Same(t, http.DefaultTransport, firstTransport.base)
	require.Equal(t, httpClientConfig{
		MaxConcurrentRequests: 2,
		RequestsPerSecond:     5,
		Burst:                 3,
	}, firstTransport.config)

	secondTransport, ok := second.gitConfig.HTTPClient.Transport.(*hostLimitTransport)
	require.True(t, ok)
	require.NotSame(t, firstTransport, secondTransport)
}
