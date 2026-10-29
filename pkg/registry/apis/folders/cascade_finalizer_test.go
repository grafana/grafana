package folders

import (
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
)

const otherFinalizer = "example.com/other"

func folderWithFinalizers(finalizers ...string) *folders.Folder {
	return &folders.Folder{
		TypeMeta:   metav1.TypeMeta{Kind: "Folder"},
		ObjectMeta: metav1.ObjectMeta{Name: "f1", Finalizers: finalizers},
		Spec:       folders.FolderSpec{Title: "f1"},
	}
}

func terminating(f *folders.Folder) *folders.Folder {
	now := metav1.Now()
	f.DeletionTimestamp = &now
	return f
}

func TestApplyCascadeDeleteFinalizerOnCreate(t *testing.T) {
	tests := []struct {
		name     string
		enabled  bool
		sent     []string
		expected []string
	}{
		{name: "enabled stamps", enabled: true, sent: nil, expected: []string{folders.CascadeDeleteFinalizer}},
		{name: "enabled does not duplicate", enabled: true, sent: []string{folders.CascadeDeleteFinalizer}, expected: []string{folders.CascadeDeleteFinalizer}},
		{name: "enabled keeps other finalizers", enabled: true, sent: []string{otherFinalizer}, expected: []string{otherFinalizer, folders.CascadeDeleteFinalizer}},
		{name: "disabled leaves none", enabled: false, sent: nil, expected: nil},
		{name: "disabled strips client-sent finalizer", enabled: false, sent: []string{folders.CascadeDeleteFinalizer}, expected: nil},
		{name: "disabled strips only ours", enabled: false, sent: []string{otherFinalizer, folders.CascadeDeleteFinalizer}, expected: []string{otherFinalizer}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := folderWithFinalizers(tt.sent...)
			applyCascadeDeleteFinalizerOnCreate(f, tt.enabled)
			require.Equal(t, tt.expected, f.Finalizers)
		})
	}
}

func TestPreserveCascadeDeleteFinalizerOnUpdate(t *testing.T) {
	tests := []struct {
		name     string
		old      *folders.Folder
		sent     []string
		expected []string
	}{
		{name: "live: restores when client omits all", old: folderWithFinalizers(folders.CascadeDeleteFinalizer), sent: nil, expected: []string{folders.CascadeDeleteFinalizer}},
		{name: "live: restores when client drops only ours", old: folderWithFinalizers(otherFinalizer, folders.CascadeDeleteFinalizer), sent: []string{otherFinalizer}, expected: []string{otherFinalizer, folders.CascadeDeleteFinalizer}},
		{name: "live: client cannot add", old: folderWithFinalizers(), sent: []string{folders.CascadeDeleteFinalizer}, expected: nil},
		{name: "live: client cannot add next to others", old: folderWithFinalizers(otherFinalizer), sent: []string{otherFinalizer, folders.CascadeDeleteFinalizer}, expected: []string{otherFinalizer}},
		{name: "live: unchanged when kept", old: folderWithFinalizers(folders.CascadeDeleteFinalizer), sent: []string{folders.CascadeDeleteFinalizer}, expected: []string{folders.CascadeDeleteFinalizer}},
		{name: "terminating: removal allowed", old: terminating(folderWithFinalizers(folders.CascadeDeleteFinalizer)), sent: nil, expected: nil},
		{name: "terminating: client cannot add", old: terminating(folderWithFinalizers()), sent: []string{folders.CascadeDeleteFinalizer}, expected: nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := folderWithFinalizers(tt.sent...)
			preserveCascadeDeleteFinalizerOnUpdate(f, tt.old)
			require.Equal(t, tt.expected, f.Finalizers)
		})
	}
}
