package provisioning

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestRegisterJobQueue(t *testing.T) {
	t.Run("returns nil when provisioning is disabled", func(t *testing.T) {
		assert.Nil(t, RegisterJobQueue(setting.NewCfg(), nil))
	})

	t.Run("attaches the queue to the builder for its post-start hook", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningJobPollInterval = 45 * time.Second
		cfg.ProvisioningMaxFileSize = 1024
		cfg.ProvisioningSyncResourceTimeout = 5 * time.Second
		builder := &APIBuilder{}

		q := RegisterJobQueue(cfg, builder)

		require.NotNil(t, q)
		assert.Same(t, q, builder.jobQueue)
		assert.Equal(t, 45*time.Second, q.cfg.JobInterval)
		assert.Equal(t, int64(1024), q.cfg.MaxFileSize)
		assert.Equal(t, 5*time.Second, q.cfg.SyncResourceTimeout)
		assert.Equal(t, jobClaimExpiry/3, q.cfg.LeaseRenewalInterval)
	})

	t.Run("falls back to the default poll interval", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.ProvisioningJobPollInterval = 0

		q := RegisterJobQueue(cfg, &APIBuilder{})

		assert.Equal(t, setting.ProvisioningJobPollIntervalDefault, q.cfg.JobInterval)
	})
}
