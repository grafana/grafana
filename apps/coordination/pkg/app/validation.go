package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"

	coordinationv0alpha1 "github.com/grafana/grafana/apps/coordination/pkg/apis/coordination/v0alpha1"
)

const (
	// minLeaseDurationSeconds floors leaseDurationSeconds to bound the fleet-wide
	// write rate (mirrors the KV lease manager's defaultMinTTL).
	minLeaseDurationSeconds = 10
	// maxLeaseDurationSeconds caps leaseDurationSeconds so worst-case takeover
	// stays under ~10 minutes.
	maxLeaseDurationSeconds = 600
)

// validateLease enforces the admission policy for coordination Leases (design §5.7):
//   - leaseDurationSeconds, when set, must be within [10, 600].
//   - on update, the holder may not change without also advancing renewTime — this
//     prevents a takeover that doesn't reset the liveness clock.
func validateLease(_ context.Context, req *app.AdmissionRequest) error {
	lease, ok := req.Object.(*coordinationv0alpha1.Lease)
	if !ok {
		return fmt.Errorf("expected Lease object, got %T", req.Object)
	}

	if d := lease.Spec.LeaseDurationSeconds; d != nil {
		if *d < minLeaseDurationSeconds || *d > maxLeaseDurationSeconds {
			return fmt.Errorf("leaseDurationSeconds must be between %d and %d, got %d",
				minLeaseDurationSeconds, maxLeaseDurationSeconds, *d)
		}
	}

	if req.Action == resource.AdmissionActionUpdate && req.OldObject != nil {
		old, ok := req.OldObject.(*coordinationv0alpha1.Lease)
		if !ok {
			return fmt.Errorf("expected old Lease object, got %T", req.OldObject)
		}
		if holderChanged(old.Spec.HolderIdentity, lease.Spec.HolderIdentity) &&
			!renewTimeAdvanced(old.Spec.RenewTime, lease.Spec.RenewTime) {
			return fmt.Errorf("holderIdentity changed without advancing renewTime")
		}
	}

	return nil
}

func holderChanged(old, new *string) bool {
	return derefString(old) != derefString(new)
}

// renewTimeAdvanced reports whether renewTime was updated to a new value. Timestamps
// are opaque RFC3339 strings here; any change is treated as an advance, since the
// authoritative ordering check is the resourceVersion CAS on the write itself.
func renewTimeAdvanced(old, new *string) bool {
	return derefString(old) != derefString(new)
}

func derefString(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}
