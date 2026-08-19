package app

import (
	"context"
	"time"

	k8sle "k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"

	"github.com/grafana/grafana-app-sdk/logging"

	coordle "github.com/grafana/grafana/apps/coordination/pkg/leaderelection"
)

const (
	// gcLeaseName is the GlobalLease the garbage collector elects its leader on. The
	// controller dogfoods the very primitive it maintains: its own leader lease is a
	// GlobalLease served by this app, and self-hosting is sound because GC only
	// deletes leases dead for hours while this lease is renewed well within its term.
	gcLeaseName = "coordination-gc"

	// Election timings are deliberately coarse. Every renewal is a served, validated
	// UPDATE to the GlobalLease, so a tight renew loop would generate constant
	// admission traffic (and log noise) for no benefit: GC only ever deletes leases
	// abandoned for hours, so a multi-minute failover is immaterial. Renewing roughly
	// once a minute keeps that traffic negligible. LeaseDuration stays within the
	// admission bounds ([10, 600]s) so the GC lease passes the same validator as any
	// other lease.
	gcLeaseDuration = 180 * time.Second
	gcRenewDeadline = 120 * time.Second
	gcRetryPeriod   = 60 * time.Second
)

// gcLeaderRunnable runs leader election on the GC GlobalLease and toggles the shared
// leader flag the reconciler consults before it deletes anything. Only the elected
// replica performs deletions; the others keep watching and stay ready to take over.
type gcLeaderRunnable struct {
	lock      resourcelock.Interface
	setLeader func(bool)
	identity  string
}

func (r *gcLeaderRunnable) Run(ctx context.Context) error {
	coordle.Run(ctx, r.lock, gcLeaseName, coordle.Timings{
		LeaseDuration: gcLeaseDuration,
		RenewDeadline: gcRenewDeadline,
		RetryPeriod:   gcRetryPeriod,
	}, k8sle.LeaderCallbacks{
		OnStartedLeading: func(context.Context) {
			r.setLeader(true)
			logging.DefaultLogger.Info("coordination GC acquired leadership", "identity", r.identity)
		},
		OnStoppedLeading: func() {
			r.setLeader(false)
			logging.DefaultLogger.Info("coordination GC lost leadership", "identity", r.identity)
		},
	})
	return ctx.Err()
}
