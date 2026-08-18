package kinds

// Lease is a cluster-scoped coordination primitive modeled field-for-field on
// coordination.k8s.io/v1 Lease. It is a dumb record: all election logic is
// client-side, the server only stores the object and enforces atomicity via
// create-conflict (409) and resourceVersion CAS on update.
//
// Cluster scope (as opposed to the tenant-namespaced Lease) exists to coordinate
// fleet-level work that is owned by no single tenant — replica leader election and
// shard ownership for multi-tenant operators. It is watchable like any Kubernetes
// resource, and every read/write is gated by the cluster-scoped storage authorizer
// (writes restricted to service/admin identities; tenant tokens denied).
lease: {
	kind:       "Lease"
	pluralName: "Leases"
	// Cluster scope: fleet coordination is owned by no tenant, so the lease lives in
	// the global (cluster-wide) keyspace rather than a tenant namespace.
	scope: "Cluster"
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	codegen: {
		ts: {enabled: false}
		go: {enabled: true}
	}
	schema: {
		// Spec mirrors coordination.k8s.io/v1 LeaseSpec. Timestamps are RFC3339
		// strings (sub-second precision) rather than metav1.MicroTime, consistent
		// with other app-platform kinds; the client adapter converts.
		spec: {
			// holderIdentity is the identity of the current holder, "<pod>_<uid>" by convention.
			holderIdentity?: string
			// leaseDurationSeconds is how long a candidate must wait after renewTime
			// before taking over. Bounds (floor 10s to cap the fleet-wide write rate,
			// ceiling 600s to keep worst-case takeover under ~10 minutes) are enforced
			// by the admission validator so the field stays int32, matching k8s.
			leaseDurationSeconds?: int32
			// acquireTime is when the current holder first acquired the lease (RFC3339).
			acquireTime?: string
			// renewTime is the last renewal; holders update this on every renew (RFC3339).
			renewTime?: string
			// leaseTransitions is incremented each time the holder changes.
			leaseTransitions?: int32
			// strategy is reserved for coordinated/preference-based election (k8s KEP-4355).
			strategy?: string
			// preferredHolder is reserved for coordinated/preference-based election (k8s KEP-4355).
			preferredHolder?: string
		}
	}
}
