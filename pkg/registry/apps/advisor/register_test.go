package advisor

import (
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/open-feature/go-sdk/openfeature/memprovider"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/setting"
)

type recordingACService struct {
	actest.FakeService
	declared *[]accesscontrol.RoleRegistration
}

func (s recordingACService) DeclareFixedRoles(registrations ...accesscontrol.RoleRegistration) error {
	*s.declared = append(*s.declared, registrations...)
	return nil
}

func setAggregationFlag(t *testing.T, variant string) {
	t.Helper()
	require.NoError(t, openfeature.SetProviderAndWait(memprovider.NewInMemoryProvider(map[string]memprovider.InMemoryFlag{
		aggregationFlag: {
			Key:            aggregationFlag,
			DefaultVariant: variant,
			Variants:       map[string]any{"enabled": true, "disabled": false},
		},
	})))
	t.Cleanup(func() {
		_ = openfeature.SetProviderAndWait(openfeature.NoopProvider{})
	})
}

func TestProvideAppInstaller(t *testing.T) {
	t.Run("skips the app when the aggregation flag is on", func(t *testing.T) {
		setAggregationFlag(t, "enabled")
		var declared []accesscontrol.RoleRegistration

		i, err := ProvideAppInstaller(recordingACService{declared: &declared}, nil, nil, setting.NewCfg(), nil, prometheus.NewRegistry())

		require.NoError(t, err)
		require.Nil(t, i)
		require.NotEmpty(t, declared, "access control roles are still registered")
	})

	t.Run("installs the app when the aggregation flag is off", func(t *testing.T) {
		setAggregationFlag(t, "disabled")
		var declared []accesscontrol.RoleRegistration

		i, err := ProvideAppInstaller(recordingACService{declared: &declared}, nil, nil, setting.NewCfg(), nil, prometheus.NewRegistry())

		require.NoError(t, err)
		require.NotNil(t, i)
		require.NotEmpty(t, declared)
	})

	t.Run("installs the app when the aggregation flag is not defined", func(t *testing.T) {
		var declared []accesscontrol.RoleRegistration

		i, err := ProvideAppInstaller(recordingACService{declared: &declared}, nil, nil, setting.NewCfg(), nil, prometheus.NewRegistry())

		require.NoError(t, err)
		require.NotNil(t, i)
		require.NotEmpty(t, declared)
	})
}
