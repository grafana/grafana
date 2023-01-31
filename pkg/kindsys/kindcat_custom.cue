package kindsys

// Custom specifies the kind category for plugin-defined arbitrary types.
// Custom kinds have the same purpose as Core kinds, differing only in
// that they are defined by external plugins rather than in Grafana core. As such,
// this specification is kept closely aligned with the Core kind.
//
// Grafana provides Kubernetes apiserver-shaped HTTP APIs for interacting with custom
// kinds - the same API patterns (and clients) used to interact with k8s CustomResources.
Custom: S={
	_sharedKind

	lineage: { name: S.machineName }
	lineageIsGroup: false
}
