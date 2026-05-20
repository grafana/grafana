package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateCreate(t *testing.T) {
	tests := []struct {
		name        string
		folder      *folders.Folder
		mockFolders map[string]*folders.Folder
		expectedErr error
		maxDepth    int // defaults to 5 unless set
	}{
		{
			name: "ok",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "p1",
					Annotations: map[string]string{"grafana.app/folder": "p2"},
				},
				Spec: folders.FolderSpec{
					Title: "some title",
				},
			},
			mockFolders: map[string]*folders.Folder{
				"p2": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "p2",
						Annotations: map[string]string{"grafana.app/folder": "p3"},
					},
					Spec: folders.FolderSpec{
						Title: "p2 title",
					},
				},
				"p3": {
					ObjectMeta: metav1.ObjectMeta{
						Name: "p3",
					},
					Spec: folders.FolderSpec{
						Title: "p3 title",
					},
				},
			},
		},
		{
			name: "reserved name - general",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: folder.GeneralFolderUID,
				},
			},
			expectedErr: folder.ErrInvalidUID,
		},
		{
			name: "reserved name - root",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: folder.RootFolderName,
				},
			},
			expectedErr: folder.ErrInvalidUID,
		},
		{
			name: "reserved name - sharedwithme",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: folder.SharedWithMeFolderUID,
				},
			},
			expectedErr: folder.ErrInvalidUID,
		},
		{
			name: "too long",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "a0123456789012345678901234567890123456789", // longer than 40
				},
			},
			expectedErr: dashboards.ErrDashboardUidTooLong,
		},
		{
			name: "bad name",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "hello world", // not a-z|0-9,
				},
			},
			expectedErr: dashboards.ErrDashboardInvalidUid,
		},
		{
			name: "can not be a parent of yourself",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "p1",
					Annotations: map[string]string{"grafana.app/folder": "p1"},
				},
				Spec: folders.FolderSpec{
					Title: "some title",
				},
			},
			expectedErr: folder.ErrFolderCannotBeParentOfItself,
		},
		{
			name: "can not create a tree that is too deep",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "p1",
					Annotations: map[string]string{"grafana.app/folder": "p2"},
				},
				Spec: folders.FolderSpec{
					Title: "some title",
				},
			},
			mockFolders: map[string]*folders.Folder{
				"p2": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "p2",
						Annotations: map[string]string{"grafana.app/folder": "p3"},
					},
					Spec: folders.FolderSpec{
						Title: "p2 title",
					},
				},
				"p3": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "p3",
						Annotations: map[string]string{"grafana.app/folder": "p4"},
					},
					Spec: folders.FolderSpec{
						Title: "p3 title",
					},
				},
				"p4": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "p4",
						Annotations: map[string]string{"grafana.app/folder": folder.GeneralFolderUID},
					},
					Spec: folders.FolderSpec{
						Title: "p4 title",
					},
				},
				folder.GeneralFolderUID: {
					ObjectMeta: metav1.ObjectMeta{
						Name: folder.GeneralFolderUID,
					},
					Spec: folders.FolderSpec{
						Title: "General",
					},
				},
			},
			maxDepth:    2,
			expectedErr: folder.ErrMaximumDepthReached,
		},
		{
			name: "can create a folder in max depth",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "5",
					Annotations: map[string]string{"grafana.app/folder": "4"},
				},
				Spec: folders.FolderSpec{
					Title: "some title",
				},
			},
			mockFolders: map[string]*folders.Folder{
				"4": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "4",
						Annotations: map[string]string{"grafana.app/folder": "3"},
					},
					Spec: folders.FolderSpec{
						Title: "4 title",
					},
				},
				"3": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "3",
						Annotations: map[string]string{"grafana.app/folder": "2"},
					},
					Spec: folders.FolderSpec{
						Title: "3 title",
					},
				},
				"2": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "2",
						Annotations: map[string]string{"grafana.app/folder": "1"},
					},
					Spec: folders.FolderSpec{
						Title: "2 title",
					},
				},
				"1": {
					ObjectMeta: metav1.ObjectMeta{
						Name: "1",
					},
					Spec: folders.FolderSpec{
						Title: "1 title",
					},
				},
			},
			maxDepth: setting.NewCfg().MaxNestedFolderDepth,
		},
		{
			name: "title is reserved name General",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "abc123",
				},
				Spec: folders.FolderSpec{
					Title: "General",
				},
			},
			expectedErr: folder.ErrNameExists,
		},
		{
			name: "title is reserved name General case insensitive",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "abc123",
				},
				Spec: folders.FolderSpec{
					Title: "GENERAL",
				},
			},
			expectedErr: folder.ErrNameExists,
		},
		{
			name: "title is reserved name General with surrounding whitespace",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "abc123",
				},
				Spec: folders.FolderSpec{
					Title: "  General  ",
				},
			},
			expectedErr: folder.ErrNameExists,
		},
		{
			name: "cannot create a circular reference",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "3",
					Annotations: map[string]string{"grafana.app/folder": "2"},
				},
				Spec: folders.FolderSpec{
					Title: "some title",
				},
			},
			expectedErr: folder.ErrCyclicReference,
			mockFolders: map[string]*folders.Folder{
				"2": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "2",
						Annotations: map[string]string{"grafana.app/folder": "1"},
					},
					Spec: folders.FolderSpec{
						Title: "2 title",
					},
				},
				"1": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "1",
						Annotations: map[string]string{"grafana.app/folder": "3"},
					},
					Spec: folders.FolderSpec{
						Title: "1 title",
					},
				},
				"3": {
					ObjectMeta: metav1.ObjectMeta{
						Name:        "3",
						Annotations: map[string]string{"grafana.app/folder": folder.GeneralFolderUID},
					},
					Spec: folders.FolderSpec{
						Title: "3 title",
					},
				},
				folder.GeneralFolderUID: {
					ObjectMeta: metav1.ObjectMeta{
						Name: folder.GeneralFolderUID,
					},
					Spec: folders.FolderSpec{
						Title: "General",
					},
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maxDepth := tt.maxDepth
			if maxDepth == 0 {
				maxDepth = 5
			}

			mockStorage := grafanarest.NewMockStorage(t)
			for name, f := range tt.mockFolders {
				f.Name = name
				mockStorage.On("Get", context.Background(), name, &metav1.GetOptions{}).Return(f, nil).Maybe()
			}

			getter := newParentsGetter(mockStorage, maxDepth)

			err := validateOnCreate(context.Background(), tt.folder, getter, maxDepth)

			if tt.expectedErr == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tt.expectedErr)
				require.Contains(t, err.Error(), tt.expectedErr.Error())
			}
		})
	}
}

func TestValidateUpdate(t *testing.T) {
	tests := []struct {
		name         string
		folder       *folders.Folder
		old          *folders.Folder
		parents      *folders.FolderInfoList
		parentsError error
		allFolders   []folders.Folder
		expectedErr  string
		maxDepth     int // defaults to 5 unless set
	}{
		{
			name: "change title",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "changed",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
		},
		{
			name: "title is reserved name General",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "General",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
			expectedErr: "folder.name-exists",
		},
		{
			name: "title is reserved name General case insensitive",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "GENERAL",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
			expectedErr: "folder.name-exists",
		},
		{
			name: "title is reserved name General with surrounding whitespace",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "  General  ",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
			expectedErr: "folder.name-exists",
		},
		{
			name: "error to move into k6 folder",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "k6-app",
					},
				},
				Spec: folders.FolderSpec{
					Title: "changed",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "nnn",
				},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
			expectedErr: "k6 project may not be moved",
		},
		{
			name: "can move a folder to max depth",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "4",
					},
				},
				Spec: folders.FolderSpec{
					Title: "changed",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
			parents: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "4", Parent: "3"},
					{Name: "3", Parent: "2"},
					{Name: "2", Parent: "1"},
					{Name: "1", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			maxDepth: 4,
		},
		{
			name: "error when moving exceeds max depth",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "test",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "5",
					},
				},
				Spec: folders.FolderSpec{
					Title: "changed",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{},
				Spec: folders.FolderSpec{
					Title: "old title",
				},
			},
			parents: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "5", Parent: "4"},
					{Name: "4", Parent: "3"},
					{Name: "3", Parent: "2"},
					{Name: "2", Parent: "1"},
					{Name: "1", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			maxDepth:    4,
			expectedErr: "[folder.maximum-depth-reached]",
		},
		{
			name: "error when moving folder under its own descendant (direct child)",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "parent",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "child",
					},
				},
				Spec: folders.FolderSpec{
					Title: "parent folder",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "parent",
				},
				Spec: folders.FolderSpec{
					Title: "parent folder",
				},
			},
			// When querying parents of "child", we get the chain: child -> parent -> root
			// This means "parent" is an ancestor of "child", so we can't move "parent" under "child"
			parents: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "child", Parent: "parent"},
					{Name: "parent", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			expectedErr: "cannot move folder under its own descendant",
		},
		{
			name: "error when moving folder under its grandchild",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "grandparent",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "grandchild",
					},
				},
				Spec: folders.FolderSpec{
					Title: "grandparent folder",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "grandparent",
				},
				Spec: folders.FolderSpec{
					Title: "grandparent folder",
				},
			},
			// When querying parents of "grandchild", we get: grandchild -> child -> grandparent -> root
			// This means "grandparent" is in the ancestry, so we can't move it under "grandchild"
			parents: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "grandchild", Parent: "child"},
					{Name: "child", Parent: "grandparent"},
					{Name: "grandparent", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			expectedErr: "cannot move folder under its own descendant",
		},
		{
			name: "error when moving folder from root to level2 with children exceeds max depth",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "folderWithChildren",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "level2",
					},
				},
				Spec: folders.FolderSpec{
					Title: "folder with children",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "folderWithChildren",
				},
				Spec: folders.FolderSpec{
					Title: "folder with children",
				},
			},
			parents: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "level2", Parent: "level1"},
					{Name: "level1", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			allFolders: []folders.Folder{
				{ObjectMeta: metav1.ObjectMeta{Name: "child1", Annotations: map[string]string{utils.AnnoKeyFolder: "folderWithChildren"}}},
				{ObjectMeta: metav1.ObjectMeta{Name: "grandchild1", Annotations: map[string]string{utils.AnnoKeyFolder: "child1"}}},
			},
			maxDepth:    4,
			expectedErr: "[folder.maximum-depth-reached]",
		},
		{
			name: "can move folder from root level to level1 with children when within max depth",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "folderWithChildren",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "level1",
					},
				},
				Spec: folders.FolderSpec{
					Title: "folder with children",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "folderWithChildren",
				},
				Spec: folders.FolderSpec{
					Title: "folder with children",
				},
			},
			parents: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "level1", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			allFolders: []folders.Folder{
				{ObjectMeta: metav1.ObjectMeta{Name: "child1", Annotations: map[string]string{utils.AnnoKeyFolder: "folderWithChildren"}}},
				{ObjectMeta: metav1.ObjectMeta{Name: "grandchild1", Annotations: map[string]string{utils.AnnoKeyFolder: "child1"}}},
			},
			maxDepth: 4,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maxDepth := tt.maxDepth
			if maxDepth == 0 {
				maxDepth = 5
			}
			m := grafanarest.NewMockStorage(t)
			if tt.parents != nil {
				for _, v := range tt.parents.Items {
					m.On("Get", context.Background(), v.Name, &metav1.GetOptions{}).Return(&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Name: v.Name,
						}, Spec: folders.FolderSpec{
							Title: v.Title,
						},
					}, nil).Maybe()
				}
			}
			for i := range tt.allFolders {
				f := tt.allFolders[i]
				m.On("Get", context.Background(), f.Name, &metav1.GetOptions{}).Return(&f, nil).Maybe()
			}

			err := validateOnUpdate(context.Background(), tt.folder, tt.old, m,
				func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error) {
					return tt.parents, tt.parentsError
				},
				&mockSearchClient{folders: tt.allFolders},
				maxDepth)

			if tt.expectedErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}
		})
	}
}

func TestValidateDelete(t *testing.T) {
	tests := []struct {
		name        string
		folder      *folders.Folder
		searcher    *mockSearchClient
		expectedErr string
	}{{
		name: "simple delete",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				// Empty stats
				Stats: []*resourcepb.ResourceStatsResponse_Stats{},
			},
		},
	}, {
		name: "stats error - nil stats",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{},
		},
		expectedErr: "could not verify if folder is empty",
	}, {
		name: "stats error - search error",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			statsErr: fmt.Errorf("error running stats"),
		},
		expectedErr: "error running stats",
	}, {
		name: "stats error - error result",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Error: &resourcepb.ErrorResult{
					Reason: "error",
				},
			},
		},
		expectedErr: "could not verify if folder is empty",
	}, {
		name: "folder not empty - contains dashboards",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
						Count:    10, // not empty
					},
				},
			},
		},
		expectedErr: "[folder.not-empty]",
	}, {
		name: "folder not empty - contains alertrules",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "alerting.grafana.app",
						Resource: "alertrules",
						Count:    5, // not empty
					},
				},
			},
		},
		expectedErr: "[folder.not-empty]",
	}, {
		name: "folder not empty - contains library_elements",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "library.grafana.app",
						Resource: "library_elements",
						Count:    3, // not empty
					},
				},
			},
		},
		expectedErr: "[folder.not-empty]",
	}, {
		name: "folder not empty - contains folders",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "folders.grafana.app",
						Resource: "folders",
						Count:    2, // not empty
					},
				},
			},
		},
		expectedErr: "[folder.not-empty]",
	}, {
		name: "folder can be deleted when it only contains non-validated resource types",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "playlist.grafana.app",
						Resource: "playlists",
						Count:    10, // has content but not a validated resource type
					},
					{
						Group:    "other.grafana.app",
						Resource: "other",
						Count:    5, // has content but not a validated resource type
					},
				},
			},
		},
	}, {
		name: "folder not empty - mixed resources with validated types",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "folders.grafana.app",
						Resource: "folders",
						Count:    10, // now validated
					},
					{
						Group:    "dashboard.grafana.app",
						Resource: "dashboards",
						Count:    2, // validated and has content
					},
				},
			},
		},
		expectedErr: "[folder.not-empty]",
	}}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateOnDelete(context.Background(), tt.folder, tt.searcher)

			if tt.expectedErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}
		})
	}
}

func TestGetChildrenBatchPagination(t *testing.T) {
	const namespace = "default"
	const parent = "p1"

	makeFolders := func(n int) []folders.Folder {
		out := make([]folders.Folder, 0, n)
		for i := 0; i < n; i++ {
			out = append(out, folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        fmt.Sprintf("c%d", i),
					Annotations: map[string]string{"grafana.app/folder": parent},
				},
			})
		}
		return out
	}

	t.Run("hasMore true via TotalHits when more pages remain (bleve path)", func(t *testing.T) {
		searcher := &mockSearchClient{folders: makeFolders(5), paginate: true}
		children, hasMore, err := getChildrenBatch(context.Background(), searcher, namespace, []string{parent}, 2, 0)
		require.NoError(t, err)
		require.Len(t, children, 2)
		require.True(t, hasMore)
	})

	t.Run("hasMore false on the final page", func(t *testing.T) {
		searcher := &mockSearchClient{folders: makeFolders(5), paginate: true}
		children, hasMore, err := getChildrenBatch(context.Background(), searcher, namespace, []string{parent}, 2, 4)
		require.NoError(t, err)
		require.Len(t, children, 1)
		require.False(t, hasMore)
	})

	t.Run("hasMore true via NextPageToken even when TotalHits is missing", func(t *testing.T) {
		searcher := &mockSearchClient{
			folders:          makeFolders(5),
			paginate:         true,
			useNextPageToken: true,
			dropTotalHits:    true,
		}
		children, hasMore, err := getChildrenBatch(context.Background(), searcher, namespace, []string{parent}, 2, 0)
		require.NoError(t, err)
		require.Len(t, children, 2)
		require.True(t, hasMore)
	})

	t.Run("hasMore false when only one page exists and neither signal indicates more", func(t *testing.T) {
		searcher := &mockSearchClient{folders: makeFolders(2), paginate: true}
		children, hasMore, err := getChildrenBatch(context.Background(), searcher, namespace, []string{parent}, 10, 0)
		require.NoError(t, err)
		require.Len(t, children, 2)
		require.False(t, hasMore)
	})
}

func TestCheckSubtreeDepthIteratesAllPages(t *testing.T) {
	// pageSize inside checkSubtreeDepthBatched is 1000, so we need >1000 children
	// under a single parent to force more than one iteration of the pagination loop.
	const namespace = "default"
	const parent = "root"
	const childCount = 1001

	all := make([]folders.Folder, 0, childCount)
	for i := 0; i < childCount; i++ {
		all = append(all, folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name:        fmt.Sprintf("c%d", i),
				Annotations: map[string]string{"grafana.app/folder": parent},
			},
		})
	}

	searcher := &mockSearchClient{folders: all, paginate: true}
	// remainingDepth is generous and children have no further descendants, so the
	// recursion bottoms out cleanly and we only exercise the sibling pagination loop.
	err := checkSubtreeDepth(context.Background(), searcher, namespace, parent, 10, 20)
	require.NoError(t, err)
	// 1 call for the first 1000 children + 1 call for the final partial page,
	// plus 1 recursive call per page that finds no grandchildren = 4 total.
	require.Equal(t, 4, searcher.searchCalls)
}

var (
	_ = resourcepb.ResourceIndexClient(&mockSearchClient{})
)

type mockSearchClient struct {
	stats    *resourcepb.ResourceStatsResponse
	statsErr error

	folders []folders.Folder

	// pagination controls (opt-in: zero values preserve the original "return everything" behavior)
	paginate         bool
	useNextPageToken bool
	dropTotalHits    bool

	searchCalls int
}

// GetStats implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return m.stats, m.statsErr
}

// Search implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) Search(ctx context.Context, req *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	m.searchCalls++

	// get the list of parents from the search request
	parentSet := make(map[string]bool)
	if req.Options != nil && req.Options.Fields != nil {
		for _, field := range req.Options.Fields {
			if field.Key == "folder" && field.Operator == "in" {
				for _, v := range field.Values {
					parentSet[v] = true
				}
			}
		}
	}

	// find children that match the parent filter
	var rows []*resourcepb.ResourceTableRow
	for i := range m.folders {
		meta, err := utils.MetaAccessor(&m.folders[i])
		if err != nil {
			continue
		}
		parentUID := meta.GetFolder()
		if parentSet[parentUID] {
			rows = append(rows, &resourcepb.ResourceTableRow{
				Key: &resourcepb.ResourceKey{Name: m.folders[i].Name},
			})
		}
	}

	if !m.paginate {
		return &resourcepb.ResourceSearchResponse{
			Results: &resourcepb.ResourceTable{Rows: rows},
		}, nil
	}

	total := int64(len(rows))
	offset := req.Offset
	if offset < 0 {
		offset = 0
	}
	if offset > total {
		offset = total
	}
	end := total
	if req.Limit > 0 && offset+req.Limit < end {
		end = offset + req.Limit
	}
	pageRows := rows[offset:end]

	nextToken := ""
	if m.useNextPageToken && end < total {
		nextToken = fmt.Sprintf("next-%d", end)
	}

	resp := &resourcepb.ResourceSearchResponse{
		Results: &resourcepb.ResourceTable{Rows: pageRows, NextPageToken: nextToken},
	}
	if !m.dropTotalHits {
		resp.TotalHits = total
	}
	return resp, nil
}

// RebuildIndexes implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// VectorSearch implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) VectorSearch(ctx context.Context, in *resourcepb.VectorSearchRequest, opts ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, fmt.Errorf("not implemented")
}
