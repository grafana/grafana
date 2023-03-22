// copied from https://github.com/grafana/grafana-app-sdk/blob/9f89091643a9d129373a61bcedaf8255f48a188d/k8s/admission_control.go
package admission

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime"
)

// AdmissionRequest is a container holding all information about an Admission Request for an AdmissionController to consume
type AdmissionRequest struct {
	Action    string
	Kind      string
	Group     string
	Version   string
	UserInfo  AdmissionUserInfo
	Object    runtime.Object
	OldObject runtime.Object
}

// AdmissionUserInfo contains user information for an admission request
type AdmissionUserInfo struct {
	Username string
	UID      string
	Groups   []string
	Extra    map[string]any
}

// copied from https://github.com/grafana/grafana-app-sdk/blob/91135dadb8ee3feae5905f042abee0b47dfd95f9/resource/client.go#L68
// PatchOp represents an RFC6902 Patch "op" value
type PatchOp string

// RFC6902 PatchOp value
const (
	PatchOpAdd     = PatchOp("add")
	PatchOpRemove  = PatchOp("remove")
	PatchOpReplace = PatchOp("replace")
	PatchOpMove    = PatchOp("move")
	PatchOpCopy    = PatchOp("copy")
	PatchOpTest    = PatchOp("test")
)

// PatchOperation represents a single patch operation. The patch operation is a JSON Patch operation,
// as specified by RFC6902 (https://www.rfc-editor.org/rfc/rfc6902)
type PatchOperation struct {
	Path      string  `json:"path"`
	Operation PatchOp `json:"op"`
	Value     any     `json:"value,omitempty"`
}

/////////////////////////

// AdmissionError is an interface which extends error to add more details for admission request rejections
type AdmissionError interface {
	error
	// StatusCode should return an HTTP status code to reject with
	StatusCode() int
	// Reason should be a machine-readable reason for the rejection
	Reason() string
}

// MutatingResponse is the mutation to perform on a request
type MutatingResponse struct {
	// PatchOperations is the list of patch ops to perform on the request as part of the mutation
	PatchOperations []PatchOperation
	Raw             runtime.Object
}

// ValidatingAdmissionController is an interface that describes any object which should validate admission of
// a request to manipulate a resource.Object.
type ValidatingAdmissionController interface {
	// Validate consumes an AdmissionRequest, then returns an error if the request should be denied.
	// The returned error SHOULD satisfy the AdmissionError interface, but callers will fallback
	// to using only the information in a simple error if not.
	Validate(context.Context, *AdmissionRequest) error
}

// MutatingAdmissionController is an interface that describes any object which should mutate a request to
// manipulate a resource.Object.
type MutatingAdmissionController interface {
	// Mutate consumes an AdmissionRequest, then returns a MutatingResponse with the relevant patch operations
	// to apply. If the request should not be admitted, ths function should return an error.
	// The returned error SHOULD satisfy the AdmissionError interface, but callers will fallback
	// to using only the information in a simple error if not.
	Mutate(context.Context, *AdmissionRequest) (*MutatingResponse, error)
}
