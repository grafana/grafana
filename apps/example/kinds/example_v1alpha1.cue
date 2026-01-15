package kinds

// This is the v1alpha1 version of the kind, which joins the kind metadata and
// version-specific information for the kind, such as the schema
examplev1alpha1: exampleKind & {
    // schema is the schema for this version of the kind
    // As an API server-expressable resource, the schema has a restricted format:
    // {
    //     spec: { ... }
    //     status: { ... } // optional
    //     metadata: { ... } // optional
    // }
    // `spec` must always be present, and is the schema for the object.
    // `status` is optional, and should contain status or state information which is typically not user-editable
    // (controlled by controllers/operators). The kind system adds some implicit status information which is
    // common across all kinds, and becomes present in the unified lineage used for code generation and other tooling.
    // `metadata` is optional, and should contain kind- or schema-specific metadata. The kind system adds
    // an explicit set of common metadata which can be found in the definition file for a CUE kind at
    // [https://github.com/grafana/grafana-app-sdk/blob/main/codegen/cuekind/def.cue]
    // additional metadata fields cannot conflict with the common metadata field names
    schema: {
        // #DefinedType is a re-usable definition for us to use in our schema. 
        // Fields leading with # are definitions in CUE and won't be included in the generated types.
        #DefinedType: {
            // Info is information about this entry. This comment, like all comments 
            // on fields or definitions, will be copied into the generated types as well.
            info: string
            // Next is an optional next element in the DefinedType, allowing for a self-referential
            // linked-list like structure. The ? in the field makes this optional.
            next?: #DefinedType
        }
        // Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
        spec: {
            // Example fields
            firstField: string
            secondField: int
            list?: #DefinedType
        }
        // status is where state and status information which may be used or updated by the operator or back-end should be placed
        // If you do not have any such information, you do not need to include this field,
        // however, as mentioned above, certain fields will be added by the kind system regardless.
        status: {
        	lastObservedGeneration: int64
        }
        // Custom is a subresource that will be stored the same way status is stored, 
        // and requires using the /custom route to update.
        // Its content is returned as part of a GET to the resource itself, just like with status.
        // To route a subresource to an arbitrary handler, use the 'routes' field instead (see below).
        custom: {
            myField: string
            otherField: string
        }
        // metadata if where kind- and schema-specific metadata goes. This is converted into typed annotations
        // with getters and setters by the code generation.
        //metadata: {
        //	kindSpecificField: string
        //}
    }

    // routes contains subresource routes for the kind, which are exposed as HTTP handlers on 'examples/<resource name>/<subresource>'.
    // This allows you to add additional non-storage-based handlers to your kind. 
    // These should only be used if the behavior cannot be accomplished by reconciliation on storage events.
    routes: {
        // This will add a handler for /foo on the resource
        "foo": {
            // GET request handler. A subresource route can have multiple methods attached to it. 
            // Allowed values are GET, POST, PUT, DELETE, PATCH, HEAD, and OPTIONS
            "GET": {
                // The response type for the GET /foo method. This will generate a go type, and will also be used for the OpenAPI definition for the route.
                response: {
                    message: string
                }
            }
        }
    }
}