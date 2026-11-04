package nats

import (
	"context"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

// clusterTLSReloadInterval is how often the certificate files are checked for
// changes. NoSigs rules out reloading on SIGHUP.
const clusterTLSReloadInterval = 15 * time.Second

type clusterTLSFiles struct {
	cert, key, ca []byte
}

func readClusterTLSFiles(c setting.NATSClusterTLSSettings) (clusterTLSFiles, error) {
	var f clusterTLSFiles
	var err error
	if f.cert, err = os.ReadFile(c.CertPath); err != nil {
		return f, fmt.Errorf("read nats cluster tls cert: %w", err)
	}
	if f.key, err = os.ReadFile(c.KeyPath); err != nil {
		return f, fmt.Errorf("read nats cluster tls key: %w", err)
	}
	if f.ca, err = os.ReadFile(c.CAPath); err != nil {
		return f, fmt.Errorf("read nats cluster tls ca: %w", err)
	}
	return f, nil
}

func (f clusterTLSFiles) fingerprint() [sha256.Size]byte {
	h := sha256.New()
	for _, b := range [][]byte{f.cert, f.key, f.ca} {
		// Length-prefix each file so moving bytes between files changes the hash.
		_, _ = fmt.Fprintf(h, "%d:", len(b))
		_, _ = h.Write(b)
	}
	return [sha256.Size]byte(h.Sum(nil))
}

// tlsConfig builds the route TLS config. Every instance both accepts and dials
// routes, so the CA verifies peers in both directions.
func (f clusterTLSFiles) tlsConfig(c setting.NATSClusterTLSSettings) (*tls.Config, error) {
	cert, err := tls.X509KeyPair(f.cert, f.key)
	if err != nil {
		return nil, fmt.Errorf("load nats cluster tls key pair: %w", err)
	}
	pool := x509.NewCertPool()
	if !pool.AppendCertsFromPEM(f.ca) {
		return nil, fmt.Errorf("no valid certificates found in nats cluster tls ca %q", c.CAPath)
	}
	return &tls.Config{
		MinVersion:   tls.VersionTLS12,
		Certificates: []tls.Certificate{cert},
		RootCAs:      pool,
		ClientCAs:    pool,
		ClientAuth:   tls.RequireAndVerifyClientCert,
	}, nil
}

func loadClusterTLS(c setting.NATSClusterTLSSettings) (*tls.Config, [sha256.Size]byte, error) {
	f, err := readClusterTLSFiles(c)
	if err != nil {
		return nil, [sha256.Size]byte{}, err
	}
	tc, err := f.tlsConfig(c)
	if err != nil {
		return nil, [sha256.Size]byte{}, err
	}
	return tc, f.fingerprint(), nil
}

// clusterTLSFailureReminder is how often a persistent reload failure is logged
// again, so it stays visible without logging every tick.
const clusterTLSFailureReminder = 10 * time.Minute

// Reasons a reload can fail, used as the failures metric label.
const (
	clusterTLSReasonRead    = "read"
	clusterTLSReasonInvalid = "invalid"
	clusterTLSReasonApply   = "apply"
)

// clusterTLSWatcher reloads the route TLS config when the certificate files
// change. It keeps serving the last valid config while the files can't be applied.
type clusterTLSWatcher struct {
	log      log.Logger
	metrics  *clusterTLSMetrics
	cfg      setting.NATSClusterTLSSettings
	interval time.Duration
	apply    func(*tls.Config) error

	// last is the fingerprint of the applied files. It changes only on a
	// successful apply, so every failure is retried on the next tick.
	last [sha256.Size]byte

	// failing is the reason of the current failure, empty while the applied
	// config matches the files.
	failing  string
	since    time.Time
	remindAt time.Time
}

func (w *clusterTLSWatcher) run(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.check()
		}
	}
}

func (w *clusterTLSWatcher) check() {
	f, err := readClusterTLSFiles(w.cfg)
	if err != nil {
		w.fail(clusterTLSReasonRead, err)
		return
	}
	sum := f.fingerprint()
	if sum == w.last {
		w.recover()
		return
	}

	tc, err := f.tlsConfig(w.cfg)
	if err != nil {
		w.fail(clusterTLSReasonInvalid, err)
		return
	}
	if err := w.apply(tc); err != nil {
		w.fail(clusterTLSReasonApply, err)
		return
	}
	w.last = sum
	w.metrics.recordReloadSuccess(time.Now())
	w.log.Info("reloaded nats cluster tls certificates")
	w.recover()
}

// fail logs a new or changed failure at once and a persistent one every
// clusterTLSFailureReminder.
func (w *clusterTLSWatcher) fail(reason string, err error) {
	w.metrics.recordReloadFailure(reason)
	now := time.Now()
	switch {
	case w.failing != reason:
		w.since = now
		w.log.Error("nats cluster tls reload failing; keeping the current certificates", "reason", reason, "err", err)
	case !now.Before(w.remindAt):
		w.log.Error("nats cluster tls reload still failing; keeping the current certificates", "reason", reason, "since", w.since, "err", err)
	default:
		return
	}
	w.failing = reason
	w.remindAt = now.Add(clusterTLSFailureReminder)
}

func (w *clusterTLSWatcher) recover() {
	if w.failing == "" {
		return
	}
	w.log.Info("nats cluster tls reload recovered", "reason", w.failing, "since", w.since)
	w.failing = ""
}
