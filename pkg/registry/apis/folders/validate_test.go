package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
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
			name: "can not create with cyclic reference",
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
					{Name: "p3", Parent: "p1"}, // NOTE the cycle
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
					{Name: "p3"},
				},
			},
			maxDepth:    2, // will become 3
			expectedErr: "folder max depth exceeded",
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
