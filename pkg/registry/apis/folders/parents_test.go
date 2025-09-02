package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestSubParent(t *testing.T) {
	type input struct {
		name   string
		folder string
	}
	tests := []struct {
		name    string
		request struct {
			name   string
			folder string
		}
		getter      map[string]*folders.Folder
		setupFn     func(*mock.Mock) // called after the getter is registered
		expected    *folders.FolderInfoList
		expectedErr string
		maxDepth    int // defaults to 5 unless set
	}{
		{
			name: "no parents",
			request: input{
				name: "test",
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test"},
			}},
		},
		{
			name: "has a parent",
			request: input{
				name:   "test",
				folder: "parent",
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "parent"},
				{Name: "parent"},
			}},
		},
		{
			name: "general has no parent",
			request: input{
				name: "general",
			},
			getter: map[string]*folders.Folder{},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "general"},
			}},
		},
		{
			name: "error in parent",
			request: input{
				name:   "test",
				folder: "parent", // NOTE that parent is not found
			},
			setupFn: func(m *mock.Mock) {
				var nothing *folders.Folder // needs to be an object
				m.On("Get", context.TODO(), "parent", &metav1.GetOptions{}).Return(
					nothing, fmt.Errorf("custom error message")).Once()
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "parent"},
				{Name: "parent", Detached: true, Description: "custom error message"},
			}},
		},
		{
			name: "parent is not a folder",
			request: input{
				name:   "test",
				folder: "parent", // not a folder
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", context.TODO(), "parent", &metav1.GetOptions{}).Return(
					&unstructured.Unstructured{}, // not a folder
					nil).Once()
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "parent"},
				{Name: "parent", Detached: true, Description: "expected folder, found: *unstructured.Unstructured"},
			}},
		},
		{
			name: "avoid cycles",
			request: input{
				name:   "test",
				folder: "test",
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", context.TODO(), "test", &metav1.GetOptions{}).Return(
					&folders.Folder{
						ObjectMeta: metav1.ObjectMeta{
							Annotations: map[string]string{
								utils.AnnoKeyFolder: "test", // invalid! this will cycle
							},
						},
					}, nil).Times(2)
			},
			expectedErr: "cyclic folder references found",
		},
		{
			name: "too deep",
			request: input{
				name:   "test",
				folder: "p1",
			},
			maxDepth:    3,
			expectedErr: "[folder.maximum-depth-reached]",
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Parent: "p1"},
				{Name: "p1", Parent: "p2"},
				{Name: "p2", Parent: "p3"},
				{Name: "p3", Parent: "p4"}, // should not try calling p4
			}},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := (grafanarest.Storage)(nil)
			m := &mock.Mock{}
			if tt.getter == nil && tt.setupFn == nil {
				// Default to filling the getter with expected results
				for _, item := range tt.expected.Items {
					m.On("Get", context.TODO(), item.Name, &metav1.GetOptions{}).Return(
						&folders.Folder{
							ObjectMeta: metav1.ObjectMeta{
								Name: item.Name,
								Annotations: map[string]string{
									utils.AnnoKeyFolder: item.Parent,
								},
							},
							Spec: folders.FolderSpec{
								Title:       item.Title,
								Description: &item.Description,
							},
						}, nil) // we don't care how often they are called
				}
			} else {
				for k, v := range tt.getter {
					v.Name = k // set the name
					m.On("Get", context.TODO(), k, &metav1.GetOptions{}).Return(v, nil).Once()
				}
				if tt.setupFn != nil {
					tt.setupFn(m)
				}
			}

			gm := storageMock{m, s}
			maxDepth := tt.maxDepth
			if maxDepth == 0 {
				maxDepth = 5
			}

			getter := newParentsGetter(gm, maxDepth)
			parents, err := getter(context.TODO(), &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name: tt.request.name,
					Annotations: map[string]string{
						utils.AnnoKeyFolder: tt.request.folder,
					}},
			})
			if tt.expectedErr == "" {
				require.NoError(t, err)
				require.NotNil(t, parents)
				require.ElementsMatch(t, tt.expected.Items, parents.Items)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}
		})
	}
}
