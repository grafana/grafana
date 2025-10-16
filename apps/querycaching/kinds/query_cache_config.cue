package kinds

querycacheconfig: {
	kind: "QueryCacheConfig"
}

querycacheconfigv1alpha1: querycacheconfig & {
	schema: {
		metadata: {
			name: string
		}
		spec: {
			use_default_ttl:  bool
			ttl_ms:           int
			ttl_resources_ms: int
			enabled:          bool
		}
	}
}
