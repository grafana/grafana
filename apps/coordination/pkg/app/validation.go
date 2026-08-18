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

// validateLease enforces the admission policy for the namespaced Lease kind.
func validateLease(_ context.Context, req *app.AdmissionRequest) error {
	obj, ok := req.Object.(*coordinationv0alpha1.Lease)
	if !ok {
		return fmt.Errorf("expected Lease object, got %T", req.Object)
	}
	var old *coordinationv0alpha1.LeaseSpec
	if req.Action == resource.AdmissionActionUpdate {
		if oldObj, ok := req.OldObject.(*coordinationv0alpha1.Lease); ok {
			old = &oldObj.Spec
		}
	}
	return validateLeaseSpec(req.Action, old, &obj.Spec)
}

// validateClusterLease enforces the admission policy for the cluster-scoped
// ClusterLease kind. The rules are identical to Lease; only the Go type differs.
func validateClusterLease(_ context.Context, req *app.AdmissionRequest) error {
	obj, ok := req.Object.(*coordinationv0alpha1.ClusterLease)
	if !ok {
		return fmt.Errorf("expected ClusterLease object, got %T", req.Object)
	}
	var old *coordinationv0alpha1.ClusterLeaseSpec
	if req.Action == resource.AdmissionActionUpdate {
		if oldObj, ok := req.OldObject.(*coordinationv0alpha1.ClusterLease); ok {
			old = &oldObj.Spec
		}
	}
	// ClusterLeaseSpec and LeaseSpec are generated from the same CUE fields, so we
	// map onto the shared primitive check.
	var oldFields *leaseSpecView
	if old != nil {
		oldFields = &leaseSpecView{HolderIdentity: old.HolderIdentity, RenewTime: old.RenewTime}
	}
	return validateSpecFields(req.Action,
		obj.Spec.LeaseDurationSeconds,
		oldFields,
		&leaseSpecView{HolderIdentity: obj.Spec.HolderIdentity, RenewTime: obj.Spec.RenewTime})
}

// leaseSpecView is the minimal subset of lease spec fields the shared admission
// rules operate on, so the same logic serves both generated spec types.
type leaseSpecView struct {
	HolderIdentity *string
	RenewTime      *string
}

// validateLeaseSpec adapts a namespaced *LeaseSpec onto the shared check.
func validateLeaseSpec(action resource.AdmissionAction, old, new *coordinationv0alpha1.LeaseSpec) error {
	var oldFields *leaseSpecView
	if old != nil {
		oldFields = &leaseSpecView{HolderIdentity: old.HolderIdentity, RenewTime: old.RenewTime}
	}
	return validateSpecFields(action, new.LeaseDurationSeconds, oldFields,
		&leaseSpecView{HolderIdentity: new.HolderIdentity, RenewTime: new.RenewTime})
}

// validateSpecFields is the shared admission policy (design §5.7):
//   - leaseDurationSeconds, when set, must be within [10, 600].
//   - on update, the holder may not change without also advancing renewTime — this
//     prevents a takeover that doesn't reset the liveness clock.
func validateSpecFields(action resource.AdmissionAction, durationSeconds *int32, old, new *leaseSpecView) error {
	if durationSeconds != nil {
		if *durationSeconds < minLeaseDurationSeconds || *durationSeconds > maxLeaseDurationSeconds {
			return fmt.Errorf("leaseDurationSeconds must be between %d and %d, got %d",
				minLeaseDurationSeconds, maxLeaseDurationSeconds, *durationSeconds)
		}
	}

	if action == resource.AdmissionActionUpdate && old != nil {
		if holderChanged(old.HolderIdentity, new.HolderIdentity) &&
			!renewTimeAdvanced(old.RenewTime, new.RenewTime) {
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
