//
// PoC shortcut: this file mimics the shape grafana-app-sdk codegen produces for a kind's status
// subresource (see e.g. apps/playlist/pkg/apis/playlist/v1/playlist_status_gen.go), but it was
// hand-written rather than generated. apps/folder/kinds/folder.cue was updated to describe this
// shape; running `make gen-apps` (or equivalent app-sdk codegen) should regenerate an equivalent
// file and this one can then be deleted. Until then, do not hand-edit the FolderStatus JSON shape
// without also updating folder.cue to match.
//

package v1

// +k8s:openapi-gen=true
type CascadeDeleteState string

const (
	CascadeDeleteStatePending CascadeDeleteState = "pending"
	CascadeDeleteStateWorking CascadeDeleteState = "working"
	CascadeDeleteStateSuccess CascadeDeleteState = "success"
	CascadeDeleteStateError   CascadeDeleteState = "error"
)

// OpenAPIModelName returns the OpenAPI model name for CascadeDeleteState.
func (CascadeDeleteState) OpenAPIModelName() string {
	return OpenAPIPrefix + "CascadeDeleteState"
}

// CascadeDeleteStatus reports the progress of an async, finalizer-driven cascade deletion of a
// folder's subtree. Written by the cascade delete controller via the folder's status subresource.
//
// +k8s:openapi-gen=true
type CascadeDeleteStatus struct {
	// State is the current phase of the cascade delete.
	State CascadeDeleteState `json:"state,omitempty"`
	// Remaining is the count of direct children (subfolders + dashboards) not yet deleted.
	Remaining int64 `json:"remaining"`
	// Errors accumulates non-fatal errors encountered while deleting children.
	Errors []string `json:"errors,omitempty"`
	// Started is the unix milli timestamp the cascade delete began.
	Started int64 `json:"started,omitempty"`
	// Finished is the unix milli timestamp the cascade delete completed (success or error).
	Finished int64 `json:"finished,omitempty"`
}

// NewCascadeDeleteStatus creates a new CascadeDeleteStatus object.
func NewCascadeDeleteStatus() *CascadeDeleteStatus {
	return &CascadeDeleteStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for CascadeDeleteStatus.
func (CascadeDeleteStatus) OpenAPIModelName() string {
	return OpenAPIPrefix + "CascadeDeleteStatus"
}

// DeepCopy creates a full deep copy of CascadeDeleteStatus.
func (s *CascadeDeleteStatus) DeepCopy() *CascadeDeleteStatus {
	cpy := &CascadeDeleteStatus{}
	s.DeepCopyInto(cpy)
	return cpy
}

// DeepCopyInto deep copies CascadeDeleteStatus into another CascadeDeleteStatus object.
func (s *CascadeDeleteStatus) DeepCopyInto(dst *CascadeDeleteStatus) {
	*dst = *s
	if s.Errors != nil {
		dst.Errors = make([]string, len(s.Errors))
		copy(dst.Errors, s.Errors)
	}
}

// FolderStatus is the status of the Folder kind.
//
// +k8s:openapi-gen=true
type FolderStatus struct {
	// CascadeDelete tracks async cascade-deletion progress for this folder's subtree.
	// PoC: the only field on FolderStatus today.
	CascadeDelete CascadeDeleteStatus `json:"cascadeDelete,omitempty"`
}

// NewFolderStatus creates a new FolderStatus object.
func NewFolderStatus() *FolderStatus {
	return &FolderStatus{}
}

// OpenAPIModelName returns the OpenAPI model name for FolderStatus.
func (FolderStatus) OpenAPIModelName() string {
	return OpenAPIPrefix + "FolderStatus"
}

// DeepCopy creates a full deep copy of FolderStatus.
func (s *FolderStatus) DeepCopy() *FolderStatus {
	cpy := &FolderStatus{}
	s.DeepCopyInto(cpy)
	return cpy
}

// DeepCopyInto deep copies FolderStatus into another FolderStatus object.
func (s *FolderStatus) DeepCopyInto(dst *FolderStatus) {
	s.CascadeDelete.DeepCopyInto(&dst.CascadeDelete)
}
