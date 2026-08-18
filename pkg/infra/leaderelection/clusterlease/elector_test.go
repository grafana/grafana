package clusterlease

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	clientrest "k8s.io/client-go/rest"

	"github.com/grafana/grafana/pkg/infra/leaderelection"
	"github.com/grafana/grafana/pkg/infra/log"
)

func TestNew(t *testing.T) {
	restCfg := &clientrest.Config{Host: "http://localhost:3000"}

	t.Run("requires a lease name", func(t *testing.T) {
		_, err := New(restCfg, leaderelection.Config{}, log.NewNopLogger())
		require.Error(t, err)
	})

	t.Run("rejects a lease duration below the admission floor", func(t *testing.T) {
		_, err := New(restCfg, leaderelection.Config{
			LeaseName:     "provisioning-controller",
			LeaseDuration: 5 * time.Second,
		}, log.NewNopLogger())
		require.ErrorContains(t, err, "lease duration")
	})

	t.Run("rejects a lease duration above the admission ceiling", func(t *testing.T) {
		_, err := New(restCfg, leaderelection.Config{
			LeaseName:     "provisioning-controller",
			LeaseDuration: 601 * time.Second,
		}, log.NewNopLogger())
		require.ErrorContains(t, err, "lease duration")
	})

	t.Run("defaults identity and timings", func(t *testing.T) {
		e, err := New(restCfg, leaderelection.Config{LeaseName: "provisioning-controller"}, log.NewNopLogger())
		require.NoError(t, err)
		require.NotEmpty(t, e.identity)
		require.Equal(t, defaultLeaseDuration, e.timings.LeaseDuration)
		require.Equal(t, defaultRenewDeadline, e.timings.RenewDeadline)
		require.Equal(t, defaultRetryPeriod, e.timings.RetryPeriod)
	})

	t.Run("honors an explicit identity", func(t *testing.T) {
		e, err := New(restCfg, leaderelection.Config{
			LeaseName: "provisioning-controller",
			Identity:  "replica-7",
		}, log.NewNopLogger())
		require.NoError(t, err)
		require.Equal(t, "replica-7", e.identity)
	})
}
