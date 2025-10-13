package folders

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/apis/folder/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestSubParent(t *testing.T) {
	tests := []struct {
		name     string
		input    *v0alpha1.Folder
		expected *v0alpha1.FolderInfoList
		setuFn   func(*mock.Mock)
	}{
		{
			name: "no parents",
			input: &v0alpha1.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "test",
					Annotations: map[string]string{},
				},
				Spec: v0alpha1.Spec{
					Title: "some tittle",
				},
			},
			expected: &v0alpha1.FolderInfoList{Items: []v0alpha1.FolderInfo{{Name: "test", Title: "some tittle"}}},
		},
		{
			name: "has a parent",
			input: &v0alpha1.Folder{
				ObjectMeta: metav1.ObjectMeta{
					Name:        "test",
					Annotations: map[string]string{"grafana.app/folder": "parent-test"},
				},
				Spec: v0alpha1.Spec{
					Title: "some tittle",
				},
			},
			setuFn: func(m *mock.Mock) {
				m.On("Get", context.TODO(), "parent-test", &metav1.GetOptions{}).Return(&v0alpha1.Folder{
					ObjectMeta: metav1.ObjectMeta{
						Name:        "parent-test",
						Annotations: map[string]string{},
					},
					Spec: v0alpha1.Spec{
						Title: "some other tittle",
					},
				}, nil).Once()
			},
			expected: &v0alpha1.FolderInfoList{Items: []v0alpha1.FolderInfo{
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
