package configchecks

import (
	"context"
	"testing"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestSecurityConfigStepSuccess(t *testing.T) {
	cfg := setting.NewCfg()
	step := &securityConfigStep{
		securitySection: cfg.SectionWithEnvOverrides("security"),
	}

	errs, err := step.Run(context.Background(), logging.DefaultLogger, nil, "security.secret_key")
	require.NoError(t, err)
	require.Len(t, errs, 0)
}

func TestSecurityConfigStepFailure(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.SectionWithEnvOverrides("security").Key("secret_key").SetValue(defaultSecretKey)
	step := &securityConfigStep{
		securitySection: cfg.SectionWithEnvOverrides("security"),
	}

	errs, err := step.Run(context.Background(), logging.DefaultLogger, nil, "security.secret_key")
	require.NoError(t, err)
	require.Len(t, errs, 1)
}
