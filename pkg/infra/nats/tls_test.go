package nats

import (
	"context"
	"crypto/tls"
	"errors"
	"os"
	"testing"
	"testing/synctest"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestBuildTLSConfig(t *testing.T) {
	t.Run("minimal config", func(t *testing.T) {
		tc, err := buildTLSConfig(setting.NATSTLSSettings{ServerName: "nats.example", InsecureSkipVerify: true})
		require.NoError(t, err)
		require.Equal(t, "nats.example", tc.ServerName)
		require.True(t, tc.InsecureSkipVerify)
		require.Nil(t, tc.RootCAs)
		require.Empty(t, tc.Certificates)
	})

	t.Run("invalid config errors", func(t *testing.T) {
		tests := []struct {
			name     string
			settings setting.NATSTLSSettings
		}{
			{"client cert without key", setting.NATSTLSSettings{CertPath: "/only/cert.pem"}},
			{"client key without cert", setting.NATSTLSSettings{KeyPath: "/only/key.pem"}},
			{"missing ca path", setting.NATSTLSSettings{CACertPath: "/does/not/exist.pem"}},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				_, err := buildTLSConfig(tt.settings)
				require.Error(t, err)
			})
		}
	})
}

func TestClusterTLSWatcher(t *testing.T) {
	const (
		failing   = "error: nats cluster tls reload failing; keeping the current certificates"
		reminder  = "error: nats cluster tls reload still failing; keeping the current certificates"
		reloaded  = "info: reloaded nats cluster tls certificates"
		recovered = "info: nats cluster tls reload recovered"
	)

	t.Run("reloads changed files only and records the success time", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)

			w.tick()
			require.Empty(t, w.applied, "unchanged files must not reload")
			require.Empty(t, w.hook.drain())

			rotated := w.ca.issue(t, "rotated")
			writeTestKeyPair(t, w.cfg, rotated)
			w.tick()
			require.Len(t, w.applied, 1)
			tc := <-w.applied
			require.Equal(t, rotated.Certificate[0], tc.Certificates[0].Certificate[0])
			require.Equal(t, tls.RequireAndVerifyClientCert, tc.ClientAuth)
			require.Equal(t, []string{reloaded}, w.hook.drain())
			require.Equal(t, float64(time.Now().Unix()), testutil.ToFloat64(w.metrics.lastReloadSuccess))

			w.tick()
			require.Empty(t, w.applied)
		})
	})

	t.Run("a persistent failure is logged once, reminded every 10 minutes, and its recovery logged", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)
			lastSuccess := testutil.ToFloat64(w.metrics.lastReloadSuccess)

			writeFileAtomic(t, w.cfg.KeyPath, keyPEM(t, w.ca.issue(t, "other")))
			w.tick()
			require.Equal(t, []string{failing}, w.hook.drain())

			ticksPerReminder := int(clusterTLSFailureReminder / clusterTLSReloadInterval)
			for range ticksPerReminder - 1 {
				w.tick()
			}
			require.Empty(t, w.hook.drain(), "no log between reminders")
			w.tick()
			require.Equal(t, []string{reminder}, w.hook.drain())

			require.Empty(t, w.applied)
			require.Equal(t, float64(ticksPerReminder+1), w.failures(clusterTLSReasonInvalid))
			require.Equal(t, lastSuccess, testutil.ToFloat64(w.metrics.lastReloadSuccess))

			writeTestKeyPair(t, w.cfg, w.ca.issue(t, "fixed"))
			w.tick()
			require.Len(t, w.applied, 1)
			require.Equal(t, []string{reloaded, recovered}, w.hook.drain())
		})
	})

	t.Run("restoring missing files is a recovery without a reload", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)
			cert, err := os.ReadFile(w.cfg.CertPath)
			require.NoError(t, err)

			require.NoError(t, os.Remove(w.cfg.CertPath))
			w.tick()
			w.tick()
			require.Equal(t, []string{failing}, w.hook.drain())
			require.Equal(t, float64(2), w.failures(clusterTLSReasonRead))

			writeFileAtomic(t, w.cfg.CertPath, cert)
			w.tick()
			require.Empty(t, w.applied, "the same files are already applied")
			require.Equal(t, []string{recovered}, w.hook.drain())
		})
	})

	t.Run("a changed failure reason is logged at once", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)

			require.NoError(t, os.Remove(w.cfg.CertPath))
			w.tick()
			writeTestKeyPair(t, w.cfg, w.ca.issue(t, "rotated"))
			writeFileAtomic(t, w.cfg.KeyPath, keyPEM(t, w.ca.issue(t, "other")))
			w.tick()
			require.Equal(t, []string{failing, failing}, w.hook.drain())
			require.Equal(t, float64(1), w.failures(clusterTLSReasonRead))
			require.Equal(t, float64(1), w.failures(clusterTLSReasonInvalid))
		})
	})

	t.Run("a failed apply is retried with unchanged files", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)
			w.applyErrs <- errors.New("reload failed")

			writeTestKeyPair(t, w.cfg, w.ca.issue(t, "rotated"))
			w.tick()
			require.Len(t, w.applied, 1)
			<-w.applied
			require.Equal(t, []string{failing}, w.hook.drain())
			require.Equal(t, float64(1), w.failures(clusterTLSReasonApply))

			w.tick()
			require.Len(t, w.applied, 1, "the same files must be applied again")
			<-w.applied
			require.Equal(t, []string{reloaded, recovered}, w.hook.drain())

			w.tick()
			require.Empty(t, w.applied, "a successful apply is recorded")
		})
	})
}

type testWatcher struct {
	*clusterTLSWatcher
	ca      *testCA
	hook    *logHook
	applied chan *tls.Config
	// applyErrs queues errors for the next applies; empty means success.
	applyErrs chan error
}

// startTestWatcher runs a watcher over freshly written files inside the
// caller's synctest bubble and stops it when the test ends.
func startTestWatcher(t *testing.T) *testWatcher {
	t.Helper()
	ca := newTestCA(t, "grafana-nats-ca")
	cfg := writeTestClusterTLS(t, ca, ca)
	_, fingerprint, err := loadClusterTLS(cfg)
	require.NoError(t, err)

	w := &testWatcher{ca: ca, hook: newLogHook(), applied: make(chan *tls.Config, 8), applyErrs: make(chan error, 8)}
	metrics := newClusterTLSMetrics(prometheus.NewRegistry())
	metrics.recordReloadSuccess(time.Now())
	w.clusterTLSWatcher = &clusterTLSWatcher{
		log:      w.hook,
		metrics:  metrics,
		cfg:      cfg,
		interval: clusterTLSReloadInterval,
		apply: func(tc *tls.Config) error {
			w.applied <- tc
			select {
			case err := <-w.applyErrs:
				return err
			default:
				return nil
			}
		},
		last: fingerprint,
	}

	ctx, cancel := context.WithCancel(t.Context())
	done := make(chan struct{})
	go func() {
		w.run(ctx)
		close(done)
	}()
	t.Cleanup(func() {
		cancel()
		<-done
	})
	return w
}

// tick advances the fake clock by one interval and waits for the check to finish.
func (w *testWatcher) tick() {
	time.Sleep(w.interval)
	synctest.Wait()
}

func (w *testWatcher) failures(reason string) float64 {
	return testutil.ToFloat64(w.metrics.reloadFailures.WithLabelValues(reason))
}
