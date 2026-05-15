package folders

import (
	"context"
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestCollectDescendantFolders(t *testing.T) {
	// Tree under test (parent → children):
	//   root → a, b
	//   a    → a1
	//   a1   → a11
	//   b    → b1, b2
	//   c    → c1            (sibling subtree; must be excluded)
	tree := []folders.Folder{
		mkFolder("root", ""),
		mkFolder("a", "root"),
		mkFolder("b", "root"),
		mkFolder("a1", "a"),
		mkFolder("a11", "a1"),
		mkFolder("b1", "b"),
		mkFolder("b2", "b"),
		mkFolder("c", ""),
		mkFolder("c1", "c"),
	}

	tests := []struct {
		name     string
		root     string
		expected []string
	}{
		{
			name:     "deep subtree",
			root:     "root",
			expected: []string{"a", "a1", "a11", "b", "b1", "b2"},
		},
		{
			name:     "leaf folder",
			root:     "a11",
			expected: nil,
		},
		{
			name:     "single level",
			root:     "c",
			expected: []string{"c1"},
		},
		{
			name:     "unknown folder",
			root:     "missing",
			expected: nil,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &subCountREST{lister: &fakeFolderLister{items: tree}}
			got, err := r.collectDescendantFolders(context.Background(), tt.root)
			require.NoError(t, err)
			sort.Strings(got)
			require.Equal(t, tt.expected, got)
		})
	}
}

func TestCollectDescendantFolders_Pagination(t *testing.T) {
	// Split a 6-folder linear chain across two pages to exercise the
	// continue-token loop. root → 1 → 2 → 3 → 4 → 5
	chain := []folders.Folder{
		mkFolder("root", ""),
		mkFolder("1", "root"),
		mkFolder("2", "1"),
		mkFolder("3", "2"),
		mkFolder("4", "3"),
		mkFolder("5", "4"),
	}
	lister := &fakeFolderLister{pages: [][]folders.Folder{chain[:3], chain[3:]}}

	r := &subCountREST{lister: lister}
	got, err := r.collectDescendantFolders(context.Background(), "root")
	require.NoError(t, err)
	sort.Strings(got)
	require.Equal(t, []string{"1", "2", "3", "4", "5"}, got)
}

func mkFolder(name, parent string) folders.Folder {
	f := folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: name}}
	if parent != "" {
		meta, _ := utils.MetaAccessor(&f)
		meta.SetFolder(parent)
	}
	return f
}

type fakeFolderLister struct {
	items []folders.Folder        // single-page mode
	pages [][]folders.Folder      // multi-page mode (each call consumes one)
	calls int
}

func (f *fakeFolderLister) NewList() runtime.Object {
	return &folders.FolderList{}
}

func (f *fakeFolderLister) List(_ context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	if len(f.pages) > 0 {
		page := f.pages[f.calls]
		f.calls++
		list := &folders.FolderList{Items: page}
		if f.calls < len(f.pages) {
			list.Continue = "next"
		}
		return list, nil
	}
	return &folders.FolderList{Items: f.items}, nil
}

func (f *fakeFolderLister) ConvertToTable(_ context.Context, _ runtime.Object, _ runtime.Object) (*metav1.Table, error) {
	return nil, nil
}
