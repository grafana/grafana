package repository

import ( "time"

	// Definitions shared by more than one kind. Schemas reference them directly; redeclaring one
	// under the same name inside a schema generates a self-referencing OpenAPI component.
	// App SDK codegen emits a copy of each per kind, prefixed with the kind name (RepositoryHealthStatus).
)

#HealthFailureType: "hook" | "health"

#HealthStatus: {
	// When not healthy, requests will not be executed
	healthy: bool
	// The type of the error
	error?: #HealthFailureType
	// When the health was checked last time
	checked?: int64
	// Summary messages (can be shown to users)
	// Will only be populated when not healthy
	// +listType=atomic
	message?: [...string]
}

#TokenStatus: {
	lastUpdated?: int64
	expiration?:  int64
}

// Mirrors metav1.StatusCause, with an additional origin field.
#ErrorDetails: {
	// Type is a machine-readable description of the cause of the error.
	// This is intended for programmatic handling and matches Kubernetes' CauseType values.
	type: string
	// Field is the path to the field or JSON pointer that caused the error.
	// This helps users and tools identify exactly where to correct the problem.
	// This field is optional and may be empty if not applicable.
	field?: string
	// Detail provides a human-readable explanation of what went wrong.
	// This message may be shown directly to users and should be actionable.
	detail?: string
	// BadValue is the value of the field that was determined to be invalid, if applicable.
	// This can be any type. This field is optional and may be omitted if not relevant.
	badValue?: _
	// Origin indicates where the error originated in validation, or the name of the external
	// service that reported the error. This can be useful for tooling or debugging,
	// and may reference a specific rule, function, or service. This field is optional and may be empty.
	origin?: string
}

// Mirrors metav1.Condition, which CUE cannot reference directly.
#Condition: {
	// type of condition in CamelCase or in foo.example.com/CamelCase.
	type: string
	// status of the condition, one of True, False, Unknown.
	status: string
	// observedGeneration represents the .metadata.generation that the condition was set based upon.
	observedGeneration?: int64
	// lastTransitionTime is the last time the condition transitioned from one status to another.
	lastTransitionTime: string & time.Time
	// reason contains a programmatic identifier indicating the reason for the condition's last transition.
	reason: string
	// message is a human readable message indicating details about the transition.
	message: string
}
