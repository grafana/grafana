package folders

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/utils/ptr"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
)

func TestSubParent(t *testing.T) {
	tests := []struct {
		name        string
		request     string // name of the folder we expect
		getter      map[string]*folders.Folder
		setupFn     func(*mock.Mock) // called after the getter is registered
		expected    *folders.FolderInfoList
		expectedErr string
	}{
		{
			name:    "no parents",
			request: "test",
			getter: map[string]*folders.Folder{
				"test": {
					Spec: folders.FolderSpec{
						Title: "some title",
					},
				},
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Title: "some title"},
			}},
		},
		{
			name:    "has a parents",
			request: "test",
			getter: map[string]*folders.Folder{
				"test": {
					ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{
							utils.AnnoKeyFolder: "parent",
						},
					},
					Spec: folders.FolderSpec{
						Title:       "some title",
						Description: ptr.To("hello"),
					},
				},
				"parent": {
					Spec: folders.FolderSpec{
						Title: "parent title",
					},
				},
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Title: "some title", Parent: "parent", Description: "hello"},
				{Name: "parent", Title: "parent title"},
			}},
		},
		{
			name:     "general is always empty",
			request:  "general",
			getter:   map[string]*folders.Folder{},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{}},
		},
		{
			name:    "not a folder",
			request: "name",
			setupFn: func(m *mock.Mock) {
				m.On("Get", context.TODO(), "name", &metav1.GetOptions{}).Return(
					&unstructured.Unstructured{}, // not a folder
					nil).Once()
			},
			expectedErr: "expecting folder, found",
		},
		{
			name:    "error getting folder",
			request: "name",
			setupFn: func(m *mock.Mock) {
				var nothing *folders.Folder // needs to be an object
				m.On("Get", context.TODO(), "name", &metav1.GetOptions{}).Return(
					nothing, fmt.Errorf("custom error message")).Once()
			},
			expectedErr: "custom error message",
		},
		{
			name:    "error in parent",
			request: "test",
			getter: map[string]*folders.Folder{
				"test": {
					ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{
							utils.AnnoKeyFolder: "parent", // NOTE that parent is not found
						},
					},
					Spec: folders.FolderSpec{
						Title: "some title",
					},
				},
			},
			setupFn: func(m *mock.Mock) {
				var nothing *folders.Folder // needs to be an object
				m.On("Get", context.TODO(), "parent", &metav1.GetOptions{}).Return(
					nothing, fmt.Errorf("custom error message")).Once()
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Title: "some title", Parent: "parent"},
				{Name: "parent", Detached: true, Description: "custom error message"},
			}},
		},
		{
			name:    "parent is not a folder",
			request: "test",
			getter: map[string]*folders.Folder{
				"test": {
					ObjectMeta: metav1.ObjectMeta{
						Annotations: map[string]string{
							utils.AnnoKeyFolder: "parent", // NOTE that parent is not found
						},
					},
					Spec: folders.FolderSpec{
						Title: "some title",
					},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", context.TODO(), "parent", &metav1.GetOptions{}).Return(
					&unstructured.Unstructured{}, // not a folder
					nil).Once()
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Title: "some title", Parent: "parent"},
				{Name: "parent", Detached: true, Description: "expected folder, found: *unstructured.Unstructured"},
			}},
		},
		{
			name:    "avoid cycles",
			request: "test",
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
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := (grafanarest.Storage)(nil)
			m := &mock.Mock{}
			for k, v := range tt.getter {
				v.Name = k // set the name
				m.On("Get", context.TODO(), k, &metav1.GetOptions{}).Return(v, nil).Once()
			}
			if tt.setupFn != nil {
				tt.setupFn(m)
			}

			gm := storageMock{m, s}

			getter := newParentsGetter(gm, 5)
			parents, err := getter(context.TODO(), tt.request)
			if tt.expectedErr == "" {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
				require.Contains(t, err.Error(), tt.expectedErr)
			}
			if tt.expected == nil {
				require.Nil(t, parents)
			} else {
				require.ElementsMatch(t, tt.expected.Items, parents.Items)
			}
		})
	}
}
