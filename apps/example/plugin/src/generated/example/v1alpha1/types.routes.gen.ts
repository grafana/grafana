// Code generated - EDITING IS FUTILE. DO NOT EDIT.

// routes contains subresource routes for the kind, which are exposed as HTTP handlers on `examples/<resource name>/<subresource>`.
// This allows you to add additional non-storage-based handlers to your kind.
// These should only be used if the behavior cannot be accomplished by reconciliation on storage events.
export interface Routes {
	// This will add a handler for /foo on the resource
	foo: {
		// GET request handler. A subresource route can have multiple methods attached to it.
		// Allowed values are GET, POST, PUT, DELETE, PATCH, HEAD, and OPTIONS
		GET: {
			// The response type for the GET /foo method.
			// This will generate a go type, and will also be used for the OpenAPI definition for the route.
			response: {
				message: string;
			};
			request: {
				message?: string;
			};
		};
	};
}

export const defaultRoutes = (): Routes => ({
	foo: {
	GET: {
	response: {
	message: "",
},
	request: {
},
},
},
});

