package v0alpha1

import (
	"net/url"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

// GetExternalDeleteURL prefers the server-provided endpoint; older snapshots may only have a public URL.
func (s *Snapshot) GetExternalDeleteURL() string {
	if s.Spec.ExternalDeleteUrl != nil && *s.Spec.ExternalDeleteUrl != "" {
		return *s.Spec.ExternalDeleteUrl
	}
	if s.Spec.ExternalUrl == nil || s.Spec.DeleteKey == nil || *s.Spec.DeleteKey == "" {
		return ""
	}
	parsed, err := url.Parse(*s.Spec.ExternalUrl)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	index := strings.LastIndex(parsed.Path, "/dashboard/snapshot/")
	if index < 0 {
		return ""
	}
	parsed.Path = parsed.Path[:index] + "/api/snapshots-delete/" + *s.Spec.DeleteKey
	parsed.RawPath = ""
	parsed.RawQuery = ""
	parsed.ForceQuery = false
	parsed.Fragment = ""
	return parsed.String()
}

// This is returned from the POST command
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardSnapshotWithDeleteKey struct {
	Snapshot `json:",inline"`

	// The delete key is only returned when the item is created.  It is not returned from a get request
	DeleteKey string `json:"deleteKey,omitempty"`
}

func (DashboardSnapshotWithDeleteKey) OpenAPIModelName() string {
	return OpenAPIPrefix + "DashboardSnapshotWithDeleteKey"
}

func (in *DashboardSnapshotWithDeleteKey) DeepCopyObject() runtime.Object {
	if in == nil {
		return nil
	}
	// nolint:staticcheck // explicit selector needed to avoid recursion with promoted DeepCopy
	out := &DashboardSnapshotWithDeleteKey{
		Snapshot:  *in.Snapshot.DeepCopy(),
		DeleteKey: in.DeleteKey,
	}
	return out
}

// Each tenant, may have different sharing options
// This is currently set using custom.ini, but multi-tenant support will need
// to be managed differently
type SnapshotSharingOptions struct {
	SnapshotsEnabled      bool   `json:"snapshotEnabled"`
	ExternalSnapshotURL   string `json:"externalSnapshotURL,omitempty"`
	ExternalSnapshotName  string `json:"externalSnapshotName,omitempty"`
	ExternalEnabled       bool   `json:"externalEnabled,omitempty"`
	ExternalSnapshotToken string `json:"-"`
	PublicMode            bool   `json:"publicMode,omitempty"`
}

func (SnapshotSharingOptions) OpenAPIModelName() string {
	return OpenAPIPrefix + "SnapshotSharingOptions"
}

// These are the values expected to be sent from an end user
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardCreateCommand struct {
	metav1.TypeMeta `json:",inline"`

	// Snapshot name
	// required:false
	Name string `json:"name"`

	// The complete dashboard model.
	// required:true
	Dashboard *common.Unstructured `json:"dashboard" binding:"Required"`

	// When the snapshot should expire in seconds in seconds. Default is never to expire.
	// required:false
	// default:0
	Expires int64 `json:"expires"`

	// these are passed when storing an external snapshot ref
	// Save the snapshot on an external server rather than locally.
	// required:false
	// default: false
	External bool `json:"external"`
}

func (DashboardCreateCommand) OpenAPIModelName() string {
	return OpenAPIPrefix + "DashboardCreateCommand"
}

// The create response
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DashboardCreateResponse struct {
	metav1.TypeMeta `json:",inline"`

	// The unique key
	Key string `json:"key"`

	// A unique key that will allow delete
	DeleteKey string `json:"deleteKey"`

	// Absolute URL to show the dashboard
	URL string `json:"url"`

	// URL that will delete the response
	DeleteURL string `json:"deleteUrl"`
}

func (DashboardCreateResponse) OpenAPIModelName() string {
	return OpenAPIPrefix + "DashboardCreateResponse"
}
