package kinds

// This is the v0alpha1 version of the kind. Please see v1alpha1 for more complete comments
// and a more complex schema and set of capabilities.
examplev0alpha1: exampleKind & {
    schema: {
        // Spec is the schema of our resource. The spec should include all the user-editable information for the kind.
        spec: {
            firstField: int
        }
        status: {
        	lastObservedGeneration: int64
        }
    }
}