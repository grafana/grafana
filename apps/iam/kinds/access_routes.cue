package kinds

accessRoutes: {
	"/access/check": {
		"POST": {
			name: "createAccessCheck"
			request: {
				body: {
					// named checks
					check: {[string]: #AccessCheckRequest}

					// Include the request inside the response
					debug: bool | *false 

					// forces the access checker to skip any caching layer
					skipCache: bool
				}
			}
			response: {
				allowed: {[string]: bool}

				// Only included when the debug flag is enabled
				debug?: {
					check: {
						[string]: {
							check: #AccessCheckRequest
							allowed: bool
						}
					}
					auth: {
						name: string
						type: string
						uid: string
					}
				}
			}
			responseMetadata: {
				typeMeta: false
				objectMeta: false
			}
		}
	}
}

#AccessCheckRequest: {
	// The requested access verb.
	verb: string

	// API group (dashboards.grafana.app)
	group: string

	// Kind eg dashboards
	resource: string

  // The specific resource
	name: string

  // Optional subresource
	subresource: string

  // Folder identifier
	folder: string

	// For non-resource requests, this will be the requested URL path
	path: string
}



	// 
	// // In grafana, this was historically called "UID", but in k8s, it is the name
	// 
	// // tenant isolation
	// namespace: string


	// // Optional subresource
	// 

// #AccessCheckRequest: {
// 	// The requested access verb.
// 	// this includes get, list, watch, create, update, patch, delete, deletecollection, and proxy,
// 	// or the lowercased HTTP verb associated with non-API requests (this includes get, put, post, patch, and delete)
// 	Verb: string // 


// 	// For non-resource requests, this will be the requested URL path
// 	// Not yet supported: Path: string
// }