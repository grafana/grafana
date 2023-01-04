package kindsys

// CustomStructured specifies the Kind category for plugin-defined arbitrary types.
// Custom kinds have the same purpose as CoreStructured kinds, differing only in
// that they are declared by external plugins rather than in Grafana core. As such,
// this specification is kept closely aligned with the CoreStructured kind.
//
// Grafana provides Kubernetes apiserver-shaped APIs for interacting with custom kinds -
// The same API patterns (and clients) used to interact with CustomResources.
#CustomStructured: {
	#Structured

	lineageIsGroup: false
	...
}
