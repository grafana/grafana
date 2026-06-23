package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/user"
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
			name: "reserved name - sharedwithme",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: folder.SharedWithMeFolderUID,
				},
			},
			expectedErr: folder.ErrInvalidUID,
		},
		{
			name: "empty title rejected",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "abc"},
				Spec:       folders.FolderSpec{Title: ""},
			},
			expectedErr: folder.ErrTitleEmpty,
		},
		{
			name: "whitespace-only title rejected after trim",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "abc"},
				Spec:       folders.FolderSpec{Title: "   \t  "},
			},
			expectedErr: folder.ErrTitleEmpty,
		},
		{
			name: "root parent annotation - empty",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "p1",
					Annotations: map[string]string{"grafana.app/folder": ""},
				},
				Spec: folders.FolderSpec{Title: "ok"},
			},
		},
		{
			name: "root parent annotation - general",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "p1",
					Annotations: map[string]string{"grafana.app/folder": folder.GeneralFolderUID},
				},
				Spec: folders.FolderSpec{Title: "ok"},
			},
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

			err := validateOnCreate(context.Background(), tt.folder, mockStorage, getter, maxDepth)

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
			name: "empty title rejected on update",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "nnn"},
				Spec:       folders.FolderSpec{Title: "   "},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "nnn"},
				Spec:       folders.FolderSpec{Title: "old"},
			},
			expectedErr: "folder.title-empty",
		},
		{
			name: "no folder change skips tree validation",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: "same-parent"},
				},
				Spec: folders.FolderSpec{Title: "new title"},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: "same-parent"},
				},
				Spec: folders.FolderSpec{Title: "old title"},
			},
		},
		{
			name: "move to root - empty parent annotation",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: ""},
				},
				Spec: folders.FolderSpec{Title: "new title"},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: "old-parent"},
				},
				Spec: folders.FolderSpec{Title: "old title"},
			},
		},
		{
			name: "move to root - general parent annotation",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: folder.GeneralFolderUID},
				},
				Spec: folders.FolderSpec{Title: "new title"},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: "old-parent"},
				},
				Spec: folders.FolderSpec{Title: "old title"},
			},
		},
		{
			name: "move to root - root parent annotation",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: folder.GeneralFolderUID},
				},
				Spec: folders.FolderSpec{Title: "new title"},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "nnn",
					Annotations: map[string]string{utils.AnnoKeyFolder: "old-parent"},
				},
				Spec: folders.FolderSpec{Title: "old title"},
			},
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
			name: "error to move the k6 folder itself",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "k6-app",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "somewhere",
					},
				},
				Spec: folders.FolderSpec{
					Title: "k6",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "k6-app",
				},
				Spec: folders.FolderSpec{
					Title: "k6",
				},
			},
			expectedErr: "k6 project may not be moved",
		},
		{
			name: "error to move the k6 folder to root",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "k6-app",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: folder.LegacyRootFolderUID, // nolint:staticcheck
					},
				},
				Spec: folders.FolderSpec{
					Title: "k6",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "k6-app",
					Annotations: map[string]string{
						utils.AnnoKeyFolder: "somewhere",
					},
				},
				Spec: folders.FolderSpec{
					Title: "k6",
				},
			},
			expectedErr: "k6 project may not be moved",
		},
		{
			name: "no-op update on k6 folder is allowed (title change, parent unchanged)",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "k6-app",
				},
				Spec: folders.FolderSpec{
					Title: "renamed",
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "k6-app",
				},
				Spec: folders.FolderSpec{
					Title: "k6",
				},
			},
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
				nil,
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
	zeroGrace := int64(0)

	tests := []struct {
		name               string
		folder             *folders.Folder
		searcher           *mockSearchClient
		deleteOptions      *metav1.DeleteOptions
		forceDeleteEnabled bool
		expectedErr        string
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
		name: "folder not empty with gracePeriodSeconds=0 is allowed",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "folder.grafana.app",
						Resource: "folders",
						Count:    2,
					},
				},
			},
		},
		deleteOptions:      &metav1.DeleteOptions{GracePeriodSeconds: &zeroGrace},
		forceDeleteEnabled: true,
	}, {
		name: "folder not empty with gracePeriodSeconds=0 is blocked when feature is disabled",
		folder: &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{
				Name: "nnn",
			},
		},
		searcher: &mockSearchClient{
			stats: &resourcepb.ResourceStatsResponse{
				Stats: []*resourcepb.ResourceStatsResponse_Stats{
					{
						Group:    "folder.grafana.app",
						Resource: "folders",
						Count:    2,
					},
				},
			},
		},
		deleteOptions:      &metav1.DeleteOptions{GracePeriodSeconds: &zeroGrace},
		forceDeleteEnabled: false,
		expectedErr:        "[folder.not-empty]",
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
						Group:    "folder.grafana.app",
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
						Group:    "folder.grafana.app",
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
			// cascadeDeleteEnabled only affects orphan-warning logging, not the bypass decision under test.
			err := validateOnDelete(context.Background(), tt.folder, tt.searcher, tt.deleteOptions, tt.forceDeleteEnabled, false)

			if tt.expectedErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}
		})
	}
}

func TestValidateTerminatingLabelUnchanged(t *testing.T) {
	userCtx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
	svcCtx := identity.WithServiceIdentityContext(context.Background(), 1)
	withLabel := map[string]string{TerminatingLabel: TerminatingLabelValue}
	folder := func(labels map[string]string) *folders.Folder {
		return &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f", Labels: labels}}
	}

	t.Run("user cannot set the label on create", func(t *testing.T) {
		err := validateTerminatingLabelUnchanged(userCtx, folder(withLabel), nil)
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("user create without the label is allowed", func(t *testing.T) {
		require.NoError(t, validateTerminatingLabelUnchanged(userCtx, folder(nil), nil))
	})

	t.Run("user cannot add the label on update", func(t *testing.T) {
		err := validateTerminatingLabelUnchanged(userCtx, folder(withLabel), folder(nil))
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("user cannot remove the label on update", func(t *testing.T) {
		err := validateTerminatingLabelUnchanged(userCtx, folder(nil), folder(withLabel))
		require.True(t, apierrors.IsForbidden(err))
	})

	t.Run("user update leaving the label unchanged is allowed", func(t *testing.T) {
		require.NoError(t, validateTerminatingLabelUnchanged(userCtx, folder(withLabel), folder(withLabel)))
	})

	t.Run("service identity may set or strip the label", func(t *testing.T) {
		require.NoError(t, validateTerminatingLabelUnchanged(svcCtx, folder(withLabel), folder(nil)))
		require.NoError(t, validateTerminatingLabelUnchanged(svcCtx, folder(nil), folder(withLabel)))
	})
}

func TestValidateCascadeFinalizerPreserved(t *testing.T) {
	userCtx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: 1})
	svcCtx := identity.WithServiceIdentityContext(context.Background(), 1)

	now := metav1.Now()
	terminating := func(finalizers []string) *folders.Folder {
		return &folders.Folder{ObjectMeta: metav1.ObjectMeta{
			Name:              "f",
			Labels:            map[string]string{TerminatingLabel: TerminatingLabelValue},
			DeletionTimestamp: &now,
			Finalizers:        finalizers,
		}}
	}
	live := func(finalizers []string) *folders.Folder {
		return &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "f", Finalizers: finalizers}}
	}
	with := []string{CascadeDeleteFinalizer}

	t.Run("user cannot strip the finalizer off a terminating folder", func(t *testing.T) {
		err := validateCascadeFinalizerPreserved(userCtx, terminating(nil), terminating(with))
		require.True(t, apierrors.IsForbidden(err), "got: %v", err)
	})

	t.Run("user update keeping the finalizer is allowed", func(t *testing.T) {
		require.NoError(t, validateCascadeFinalizerPreserved(userCtx, terminating(with), terminating(with)))
	})

	t.Run("service identity may strip the finalizer", func(t *testing.T) {
		require.NoError(t, validateCascadeFinalizerPreserved(svcCtx, terminating(nil), terminating(with)))
	})

	t.Run("stripping on a non-terminating folder is left to Mutate", func(t *testing.T) {
		require.NoError(t, validateCascadeFinalizerPreserved(userCtx, live(nil), live(with)))
	})

	t.Run("nothing to preserve when the old folder had no finalizer", func(t *testing.T) {
		require.NoError(t, validateCascadeFinalizerPreserved(userCtx, terminating(nil), terminating(nil)))
	})

	t.Run("create has no old object", func(t *testing.T) {
		require.NoError(t, validateCascadeFinalizerPreserved(userCtx, terminating(nil), nil))
	})
}

func TestValidateRejectsChildrenUnderTerminatingParent(t *testing.T) {
	ctx := context.Background()
	terminatingParent := &folders.Folder{ObjectMeta: metav1.ObjectMeta{
		Name:   "parent",
		Labels: map[string]string{TerminatingLabel: TerminatingLabelValue},
	}}

	t.Run("create under a terminating parent is forbidden", func(t *testing.T) {
		store := grafanarest.NewMockStorage(t)
		store.On("Get", ctx, "parent", &metav1.GetOptions{}).Return(terminatingParent, nil)
		child := &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{Name: "child", Annotations: map[string]string{"grafana.app/folder": "parent"}},
			Spec:       folders.FolderSpec{Title: "child"},
		}

		err := validateOnCreate(ctx, child, store, newParentsGetter(store, 5), 5)
		require.True(t, apierrors.IsForbidden(err), "got: %v", err)
	})

	t.Run("move under a terminating parent is forbidden", func(t *testing.T) {
		store := grafanarest.NewMockStorage(t)
		store.On("Get", ctx, "parent", &metav1.GetOptions{}).Return(terminatingParent, nil)
		old := &folders.Folder{ObjectMeta: metav1.ObjectMeta{Name: "child"}, Spec: folders.FolderSpec{Title: "child"}}
		moved := &folders.Folder{
			ObjectMeta: metav1.ObjectMeta{Name: "child", Annotations: map[string]string{"grafana.app/folder": "parent"}},
			Spec:       folders.FolderSpec{Title: "child"},
		}

		// nil accessClient -> checkMoveAccess is a no-op; the terminating-parent check runs before
		// the searcher-backed depth check, so a nil searcher is fine.
		err := validateOnUpdate(ctx, moved, old, store, newParentsGetter(store, 5), nil, nil, 5)
		require.True(t, apierrors.IsForbidden(err), "got: %v", err)
	})
}

func TestValidateOwnerReferencesOnManagedFolder(t *testing.T) {
	repoAnnotations := map[string]string{utils.AnnoKeyManagerKind: string(utils.ManagerKindRepo)}
	ownerRef := metav1.OwnerReference{APIVersion: "v1", Kind: "ConfigMap", Name: "owner-a", UID: "owner-a-uid"}
	differentOwnerRef := metav1.OwnerReference{APIVersion: "v1", Kind: "ConfigMap", Name: "owner-b", UID: "owner-b-uid"}

	tests := []struct {
		name      string
		obj       *folders.Folder
		old       *folders.Folder
		forbidden bool
	}{
		{
			name: "neither managed - owner refs allowed on create",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "f", OwnerReferences: []metav1.OwnerReference{ownerRef}},
			},
		},
		{
			name: "neither managed - owner refs allowed on update",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "f", OwnerReferences: []metav1.OwnerReference{ownerRef}},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "f"},
			},
		},
		{
			name: "new managed on create with no owner refs - ok",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "f", Annotations: repoAnnotations},
			},
		},
		{
			name: "new managed on create with owner refs - forbidden",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					Annotations:     repoAnnotations,
					OwnerReferences: []metav1.OwnerReference{ownerRef},
				},
			},
			forbidden: true,
		},
		{
			name: "old managed, owner refs unchanged - ok",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					Annotations:     repoAnnotations,
					OwnerReferences: []metav1.OwnerReference{ownerRef},
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					Annotations:     repoAnnotations,
					OwnerReferences: []metav1.OwnerReference{ownerRef},
				},
			},
		},
		{
			name: "old managed, owner refs added - forbidden",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					Annotations:     repoAnnotations,
					OwnerReferences: []metav1.OwnerReference{ownerRef},
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "f", Annotations: repoAnnotations},
			},
			forbidden: true,
		},
		{
			name: "old managed, owner refs changed - forbidden",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					Annotations:     repoAnnotations,
					OwnerReferences: []metav1.OwnerReference{differentOwnerRef},
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					Annotations:     repoAnnotations,
					OwnerReferences: []metav1.OwnerReference{ownerRef},
				},
			},
			forbidden: true,
		},
		{
			name: "new object loses managed-by but had owner refs - rejected because old was managed",
			obj: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:            "f",
					OwnerReferences: []metav1.OwnerReference{ownerRef},
				},
			},
			old: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{Name: "f", Annotations: repoAnnotations},
			},
			forbidden: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateOwnerReferencesOnManagedFolder(tt.obj, tt.old)
			if tt.forbidden {
				require.Error(t, err)
				require.True(t, apierrors.IsForbidden(err), "expected Forbidden, got %T: %v", err, err)
			} else {
				require.NoError(t, err)
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

// allow is a single (group, resource, verb, name, folder) tuple the mock
// authlib client treats as Allowed; everything else is denied.
type allow struct{ group, resource, verb, name, folder string }

func TestCheckMoveAccess(t *testing.T) {
	const (
		namespace    = "default"
		orgID        = int64(1)
		sourceUID    = "source"
		oldParentUID = "oldParent"
		newParentUID = "newParent"
	)

	folderGVR := folders.FolderResourceInfo.GroupVersionResource()
	allowFolder := func(verb, name, folderUID string) allow {
		return allow{group: folderGVR.Group, resource: folderGVR.Resource, verb: verb, name: name, folder: folderUID}
	}

	// Common allows: user can update source under its current parent (so the
	// escalation check passes for "update" when present), and can create
	// folders in the new parent (so destination-write passes). Tests override
	// these via additionalAllows / nilClient / no destination-write entry.
	canCreateFolderInNew := allowFolder(utils.VerbCreate, "", newParentUID)
	canUpdateOnSourceUnderOld := allowFolder(utils.VerbUpdate, sourceUID, oldParentUID)
	canUpdateOnSourceUnderNew := allowFolder(utils.VerbUpdate, sourceUID, newParentUID)

	tests := []struct {
		name        string
		newParent   string
		oldParent   string
		nilClient   bool
		allows      []allow
		expectedErr string
	}{
		{
			name:      "nil accessClient is a no-op",
			newParent: newParentUID,
			oldParent: oldParentUID,
			nilClient: true,
		},
		{
			name:      "no create on new parent denies the move",
			newParent: newParentUID,
			oldParent: oldParentUID,
			// no canCreateFolderInNew → destination-write fails
			expectedErr: "folders.forbiddenMove",
		},
		{
			name:      "create on new parent and no extra capabilities is allowed",
			newParent: newParentUID,
			oldParent: oldParentUID,
			allows:    []allow{canCreateFolderInNew},
		},
		{
			name:        "folder verb allowed on source only under new parent is escalation",
			newParent:   newParentUID,
			oldParent:   oldParentUID,
			allows:      []allow{canCreateFolderInNew, canUpdateOnSourceUnderNew},
			expectedErr: "folders.accessEscalation",
		},
		{
			name:      "folder verb allowed on source under both parents is not escalation",
			newParent: newParentUID,
			oldParent: oldParentUID,
			allows:    []allow{canCreateFolderInNew, canUpdateOnSourceUnderNew, canUpdateOnSourceUnderOld},
		},
		{
			name:      "move to root requires create at root",
			newParent: folder.GeneralFolderUID,
			oldParent: oldParentUID,
			allows:    []allow{allowFolder(utils.VerbCreate, "", folder.GeneralFolderUID)},
		},
		{
			name:        "move to root denied without create at root",
			newParent:   folder.GeneralFolderUID,
			oldParent:   oldParentUID,
			expectedErr: "folders.forbiddenMove",
		},
		{
			// Tier model: gaining a *different* verb at the same tier is not
			// escalation. Old=update (Editor), new=delete (Editor) → no jump.
			name:      "same-tier verb swap (update→delete) is not escalation",
			newParent: newParentUID,
			oldParent: oldParentUID,
			allows: []allow{
				canCreateFolderInNew,
				allowFolder(utils.VerbUpdate, sourceUID, oldParentUID),
				allowFolder(utils.VerbDelete, sourceUID, newParentUID),
			},
		},
		{
			// Tier model: losing capability at the destination is never
			// escalation. Old=Admin (setperms), new=Editor (update only).
			name:      "tier downgrade Admin→Editor is not escalation",
			newParent: newParentUID,
			oldParent: oldParentUID,
			allows: []allow{
				canCreateFolderInNew,
				allowFolder(utils.VerbSetPermissions, sourceUID, oldParentUID),
				allowFolder(utils.VerbUpdate, sourceUID, newParentUID),
			},
		},
		{
			// Tier model: gaining Admin (setperms) where the user only had
			// Editor (update) before is a tier jump → escalation.
			name:      "tier upgrade Editor→Admin on folder is escalation",
			newParent: newParentUID,
			oldParent: oldParentUID,
			allows: []allow{
				canCreateFolderInNew,
				canUpdateOnSourceUnderOld,
				canUpdateOnSourceUnderNew,
				allowFolder(utils.VerbSetPermissions, sourceUID, newParentUID),
			},
			expectedErr: "folders.accessEscalation",
		},
		{
			// Tier model: gaining View (None → Viewer) is a tier jump on its
			// own → escalation. Catches read-only access gained by the move.
			name:      "tier upgrade None→Viewer is escalation",
			newParent: newParentUID,
			oldParent: oldParentUID,
			allows: []allow{
				canCreateFolderInNew,
				allowFolder(utils.VerbGet, sourceUID, newParentUID),
			},
			expectedErr: "folders.accessEscalation",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := identity.WithRequester(context.Background(), &user.SignedInUser{
				UserID: 1,
				OrgID:  orgID,
			})

			var client authlib.AccessClient
			var mock *mockAccessClient
			if !tt.nilClient {
				mock = newMockAccessClient(tt.allows)
				client = mock
			}

			err := checkMoveAccess(ctx, namespace, sourceUID, tt.oldParent, tt.newParent, client)
			if tt.expectedErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}

			// All access checks must be batched into one BatchCheck round-trip.
			if mock != nil {
				require.Equal(t, 1, mock.batchCheckCall, "expected exactly one BatchCheck call")
			}
		})
	}

	t.Run("surfaces BatchCheck transport error", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: orgID})
		mock := newMockAccessClient(nil)
		mock.batchCheckErr = fmt.Errorf("boom")
		err := checkMoveAccess(ctx, namespace, sourceUID, oldParentUID, newParentUID, mock)
		require.ErrorContains(t, err, "boom")
		require.Equal(t, 1, mock.batchCheckCall)
	})

	t.Run("fails closed when BatchCheck omits the write-destination result", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: orgID})
		mock := newMockAccessClient([]allow{canCreateFolderInNew})
		mock.dropResultFor = "writeDest"
		err := checkMoveAccess(ctx, namespace, sourceUID, oldParentUID, newParentUID, mock)
		require.ErrorContains(t, err, "no result for destination write")
	})

	t.Run("fails closed when BatchCheck omits an escalation verb result", func(t *testing.T) {
		ctx := identity.WithRequester(context.Background(), &user.SignedInUser{UserID: 1, OrgID: orgID})
		mock := newMockAccessClient([]allow{canCreateFolderInNew})
		mock.dropResultFor = "newFolder|" + utils.VerbGet
		err := checkMoveAccess(ctx, namespace, sourceUID, oldParentUID, newParentUID, mock)
		require.ErrorContains(t, err, "no result for verb")
	})
}

type mockAccessClient struct {
	allowed        map[allow]struct{}
	batchCheckCall int
	batchCheckErr  error
	dropResultFor  string // CorrelationID to omit from BatchCheckResponse, simulating a bad server
}

func newMockAccessClient(allows []allow) *mockAccessClient {
	m := &mockAccessClient{allowed: make(map[allow]struct{}, len(allows))}
	for _, a := range allows {
		m.allowed[a] = struct{}{}
	}
	return m
}

func (m *mockAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	_, ok := m.allowed[allow{group: req.Group, resource: req.Resource, verb: req.Verb, name: req.Name, folder: folder}]
	return authlib.CheckResponse{Allowed: ok, Zookie: authlib.NoopZookie{}}, nil
}

func (m *mockAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	m.batchCheckCall++
	if m.batchCheckErr != nil {
		return authlib.BatchCheckResponse{}, m.batchCheckErr
	}
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, c := range req.Checks {
		if c.CorrelationID == m.dropResultFor {
			continue
		}
		_, ok := m.allowed[allow{group: c.Group, resource: c.Resource, verb: c.Verb, name: c.Name, folder: c.Folder}]
		results[c.CorrelationID] = authlib.BatchCheckResult{Allowed: ok}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func (m *mockAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(string, string) bool { return false }, authlib.NoopZookie{}, nil
}

// RebuildIndexes implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) RebuildIndexes(ctx context.Context, in *resourcepb.RebuildIndexesRequest, opts ...grpc.CallOption) (*resourcepb.RebuildIndexesResponse, error) {
	return nil, fmt.Errorf("not implemented")
}

// VectorSearch implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) VectorSearch(ctx context.Context, in *resourcepb.VectorSearchRequest, opts ...grpc.CallOption) (*resourcepb.VectorSearchResponse, error) {
	return nil, fmt.Errorf("not implemented")
}
