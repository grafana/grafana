package local

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

func TestExtra_BuildOptions(t *testing.T) {
	extra := Extra(t.TempDir(), nil, nil)
	config := &provisioning.Repository{Spec: provisioning.RepositorySpec{Type: provisioning.LocalRepositoryType}}
	result, err := extra.Build(context.Background(), config, repository.WithTimeout(time.Second), repository.WithRetries(2))
	require.NoError(t, err)
	require.Same(t, config, result.Config())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	result, err = extra.Build(ctx, config, repository.WithTimeout(time.Second), repository.WithRetries(2))
	require.ErrorIs(t, err, context.Canceled)
	require.Nil(t, result)
}
