package nats

import (
	"context"
	"crypto/tls"
	"errors"
	"os"
	"testing"
	"testing/synctest"
	"time"

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
	t.Run("reloads changed files only", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)

			w.tick()
			require.Empty(t, w.applied, "unchanged files must not reload")

			rotated := w.ca.issue(t, "rotated")
			writeTestKeyPair(t, w.cfg, rotated)
			w.tick()
			require.Len(t, w.applied, 1)
			tc := <-w.applied
			require.Equal(t, rotated.Certificate[0], tc.Certificates[0].Certificate[0])
			require.Equal(t, tls.RequireAndVerifyClientCert, tc.ClientAuth)

			w.tick()
			require.Empty(t, w.applied)
		})
	})

	t.Run("an invalid pair is reported once and retried after the files change", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)

			writeFileAtomic(t, w.cfg.KeyPath, keyPEM(t, w.ca.issue(t, "other")))
			w.tick()
			w.tick()
			require.Empty(t, w.applied)
			require.Len(t, w.hook.msgs, 1)
			require.Contains(t, <-w.hook.msgs, "invalid nats cluster tls files")

			writeTestKeyPair(t, w.cfg, w.ca.issue(t, "fixed"))
			w.tick()
			require.Len(t, w.applied, 1)
		})
	})

	t.Run("missing files keep the current certificates until restored", func(t *testing.T) {
		synctest.Test(t, func(t *testing.T) {
			w := startTestWatcher(t)
			cert, err := os.ReadFile(w.cfg.CertPath)
			require.NoError(t, err)

			require.NoError(t, os.Remove(w.cfg.CertPath))
			w.tick()
			w.tick()
			require.Empty(t, w.applied)
			require.Len(t, w.hook.msgs, 2, "a missing file is reported every tick")
			require.Contains(t, <-w.hook.msgs, "failed to read nats cluster tls files")

			// Restoring the same files is not a change.
			writeFileAtomic(t, w.cfg.CertPath, cert)
			w.tick()
			require.Empty(t, w.applied)

			require.NoError(t, os.Remove(w.cfg.KeyPath))
			w.tick()
			writeTestKeyPair(t, w.cfg, w.ca.issue(t, "restored"))
			w.tick()
			require.Len(t, w.applied, 1)
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
			require.Contains(t, <-w.hook.msgs, "failed to reload nats cluster tls certificates")

			w.tick()
			require.Len(t, w.applied, 1, "the same files must be applied again")
			<-w.applied

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
	w.clusterTLSWatcher = &clusterTLSWatcher{
		log:      w.hook,
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
