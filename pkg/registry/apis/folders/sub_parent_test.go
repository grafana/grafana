package folders

import (
	"context"
	"testing"

	folders "github.com/grafana/grafana/pkg/apis/folder/v1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSubParent(t *testing.T) {
	tests := []struct {
		name     string
		input    *folders.Folder
		expected *folders.FolderInfoList
		setuFn   func(*mock.Mock)
	}{
		{
			name: "no parents",
			input: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "test",
					Annotations: map[string]string{},
				},
				Spec: folders.Spec{
					Title: "some tittle",
				},
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{{Name: "test", Title: "some tittle"}}},
		},
		{
			name: "has a parent",
			input: &folders.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "test",
					Annotations: map[string]string{"grafana.app/folder": "parent-test"},
				},
				Spec: folders.Spec{
					Title: "some tittle",
				},
			},
			setuFn: func(m *mock.Mock) {
				m.On("Get", context.TODO(), "parent-test", &metav1.GetOptions{}).Return(&folders.Folder{
					ObjectMeta: metav1.ObjectMeta{
						Name:        "parent-test",
						Annotations: map[string]string{},
					},
					Spec: folders.Spec{
						Title: "some other tittle",
					},
				}, nil).Once()
			},
			expected: &folders.FolderInfoList{Items: []folders.FolderInfo{
				{Name: "test", Title: "some tittle", Parent: "parent-test"},
				{Name: "parent-test", Title: "some other tittle"}},
			}},
	}
	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	gm := storageMock{m, s}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			r := &subParentsREST{
				getter: gm,
			}
			if tt.setuFn != nil {
				tt.setuFn(m)
			}
			parents := r.parents(context.TODO(), tt.input)
			require.Equal(t, tt.expected, parents)
		})
	}
}
