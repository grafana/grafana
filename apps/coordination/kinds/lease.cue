package kinds

// leaseSpecFields mirrors coordination.k8s.io/v1 LeaseSpec and is shared, via CUE
// unification, by both the namespaced Lease and the cluster-scoped ClusterLease.
// A lease is a dumb record: all election logic is client-side, the server only
// stores the object and enforces atomicity via create-conflict (409) and
// resourceVersion CAS on update. Timestamps are RFC3339 strings (sub-second
// precision) rather than metav1.MicroTime, consistent with other app-platform
// kinds; the client adapter converts.
leaseSpecFields: {
	// holderIdentity is the identity of the current holder, "<pod>_<uid>" by convention.
	holderIdentity?: string
	// leaseDurationSeconds is how long a candidate must wait after renewTime before
	// taking over. Bounds (floor 10s to cap the fleet-wide write rate, ceiling 600s to
	// keep worst-case takeover under ~10 minutes) are enforced by the admission
	// validator so the field stays int32, matching k8s.
	leaseDurationSeconds?: int32
	// acquireTime is when the current holder first acquired the lease (RFC3339).
	acquireTime?: string
	// renewTime is the last renewal; holders update this on every renew (RFC3339).
	renewTime?: string
	// leaseTransitions is incremented each time the holder changes.
	leaseTransitions?: int32
}

// Lease coordinates work whose domain is a single tenant (org/stack). It lives in
// that tenant's namespace, where namespace==tenant is exactly the right isolation
// boundary and ordinary namespace authorization applies.
lease: {
	kind:       "Lease"
	pluralName: "Leases"
	scope:      "Namespaced"
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
		spec: leaseSpecFields
	}
}

// ClusterLease coordinates fleet-level work owned by no tenant — replica leader
// election and shard ownership across a multi-tenant operator's replicas. It lives
// in the cluster (global) scope rather than any tenant namespace, is watchable like
// any Kubernetes resource, and every read/write is gated by the cluster-scoped
// storage authorizer (service/admin identities only; owner-scoped per service).
clusterLease: {
	kind:       "ClusterLease"
	pluralName: "ClusterLeases"
	scope:      "Cluster"
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
		spec: leaseSpecFields
	}
}
