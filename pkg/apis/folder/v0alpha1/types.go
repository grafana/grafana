package v0alpha1

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type Folder struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec Spec `json:"spec,omitempty"`
}

type Spec struct {
	// Describe the feature toggle
	Title string `json:"title"`

	// Describe the feature toggle
	Description string `json:"description,omitempty"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	Items []Folder `json:"items,omitempty"`
}

// FolderInfoList returns a list of folder references (parents or children)
// Unlike FolderList, each item is not a full k8s object
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderInfoList struct {
	metav1.TypeMeta `json:",inline"`
	metav1.ListMeta `json:"metadata,omitempty"`

	// +listType=map
	// +listMapKey=uid
	Items []FolderInfo `json:"items,omitempty"`
}

// FolderInfo briefly describes a folder -- unlike a folder resource,
// this is a partial record of the folder metadata used for navigating parents and children
type FolderInfo struct {
	// UID is the unique identifier for a folder (and the k8s name)
	UID string `json:"uid"`

	// Title is the display value
	Title string `json:"title"`

	// The parent folder UID
	Parent string `json:"parent,omitempty"`
}

// Access control information for the current user
// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type FolderAccessInfo struct {
	metav1.TypeMeta `json:",inline"`

	CanSave   bool `json:"canSave"`
	CanEdit   bool `json:"canEdit"`
	CanAdmin  bool `json:"canAdmin"`
	CanDelete bool `json:"canDelete"`
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object
type DescendantCounts struct {
	metav1.TypeMeta `json:",inline"`

	Counts []ResourceStats `json:"counts"`
}

type ResourceStats struct {
	Group    string `json:"group"`
	Resource string `json:"resource"`
	Count    int64  `json:"count"`
}

func UnstructuedToResouceStats(u *unstructured.Unstructured) (*ResourceStats, error) {
	group, _, err := unstructured.NestedString(u.Object, "group")
	if err != nil {
		return nil, err
	}

	resource, _, err := unstructured.NestedString(u.Object, "resource")
	if err != nil {
		return nil, err
	}

	count, _, err := unstructured.NestedInt64(u.Object, "count")
	if err != nil {
		return nil, err
	}

	return &ResourceStats{
		Group:    group,
		Resource: resource,
		Count:    count,
	}, nil
}

func UnstructedToDescendantCounts(u *unstructured.Unstructured) (*DescendantCounts, error) {
	counts, ok := u.Object["counts"].([]interface{})
	if !ok {
		return nil, fmt.Errorf("counts is not an array")
	}

	stats := make([]ResourceStats, 0, len(counts))
	for _, c := range counts {
		count, ok := c.(map[string]interface{})
		if !ok {
			return nil, fmt.Errorf("count is not a map")
		}

		s, err := UnstructuedToResouceStats(&unstructured.Unstructured{Object: count})
		if err != nil {
			return nil, err
		}
		stats = append(stats, *s)
	}

	return &DescendantCounts{
		Counts: stats,
	}, nil
}
