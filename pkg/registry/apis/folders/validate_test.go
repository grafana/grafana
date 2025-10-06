package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestValidateCreate(t *testing.T) {
	tests := []struct {
		name        string
		folder      *folders.Folder
		getter      *folders.FolderInfoList
		getterError error
		expectedErr string
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
			getter: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "p2", Parent: "p3"},
					{Name: "p3"},
				},
			},
		},
		{
			name: "reserved name",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "general", // can not name something with general
				},
			},
			expectedErr: "invalid uid for folder provided",
		},
		{
			name: "too long",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "a0123456789012345678901234567890123456789", // longer than 40
				},
			},
			expectedErr: "uid too long, max 40 characters",
		},
		{
			name: "bad name",
			folder: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: "hello world", // not a-z|0-9,
				},
			},
			expectedErr: "uid contains illegal characters",
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
			expectedErr: "folder cannot be parent of itself",
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
			getter: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "p2", Parent: "p3"},
					{Name: "p3", Parent: "p4"},
					{Name: "p4", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			maxDepth:    2,
			expectedErr: "folder max depth exceeded",
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
			getter: &folders.FolderInfoList{
				Items: []folders.FolderInfo{
					{Name: "4", Parent: "3"},
					{Name: "3", Parent: "2"},
					{Name: "2", Parent: "1"},
					{Name: "1", Parent: folder.GeneralFolderUID},
					{Name: folder.GeneralFolderUID},
				},
			},
			maxDepth: folder.MaxNestedFolderDepth,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			maxDepth := tt.maxDepth
			if maxDepth == 0 {
				maxDepth = 5
			}
			err := validateOnCreate(context.Background(), tt.folder,
				func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error) {
					return tt.getter, tt.getterError
				}, maxDepth)

			if tt.expectedErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
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
			name: "no error when moving to max depth",
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
			maxDepth:    folder.MaxNestedFolderDepth,
			expectedErr: "[folder.maximum-depth-reached]",
		},
		{
			name: "error when moving too deep",
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
			maxDepth:    folder.MaxNestedFolderDepth,
			expectedErr: "[folder.maximum-depth-reached]",
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

			err := validateOnUpdate(context.Background(), tt.folder, tt.old, m,
				func(ctx context.Context, folder *folders.Folder) (*folders.FolderInfoList, error) {
					return tt.parents, tt.parentsError
				}, maxDepth)

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
		name: "stats error",
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
		name: "stats error",
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
		name: "stats error",
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
		name: "folder not empty",
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
						Count:    10, // not empty
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

var (
	_ = resourcepb.ResourceIndexClient(&mockSearchClient{})
)

type mockSearchClient struct {
	stats    *resourcepb.ResourceStatsResponse
	statsErr error

	search    *resourcepb.ResourceSearchResponse
	searchErr error
}

// GetStats implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) GetStats(ctx context.Context, in *resourcepb.ResourceStatsRequest, opts ...grpc.CallOption) (*resourcepb.ResourceStatsResponse, error) {
	return m.stats, m.statsErr
}

// Search implements resourcepb.ResourceIndexClient.
func (m *mockSearchClient) Search(ctx context.Context, in *resourcepb.ResourceSearchRequest, opts ...grpc.CallOption) (*resourcepb.ResourceSearchResponse, error) {
	return m.search, m.searchErr
}
