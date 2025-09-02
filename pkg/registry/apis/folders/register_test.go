package folders

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/admission"

	folders "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

func TestFolderAPIBuilder_Validate_Create(t *testing.T) {
	type input struct {
		obj         *folders.Folder
		annotations map[string]string
		name        string
	}

	deepFolder := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "foo",
		},
	}
	deepFolder.Name = "valid-parent"
	deepFolder.Annotations = map[string]string{"grafana.app/folder": "valid-grandparent"}
	parentFolder := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "foo-grandparent",
		},
	}
	deepFolder.Name = "valid-grandparent"

	tests := []struct {
		name    string
		input   input
		setupFn func(*mock.Mock)
		err     error
	}{
		{
			name: "should return error when name is invalid",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "foo",
					},
				},
				name: folderValidationRules.invalidNames[0],
			},
			err: dashboards.ErrFolderInvalidUID,
		},
		{
			name: "should return no error if every validation passes",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "foo",
					},
				},
				name: "valid-name",
			},
		},
		{
			name: "should not allow creating a folder in a tree that is too deep",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "foo",
					},
				},
				annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				name:        "valid-name",
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, "valid-parent", mock.Anything).Return(
					deepFolder,
					nil)
				m.On("Get", mock.Anything, "valid-grandparent", mock.Anything).Return(
					parentFolder,
					nil)
			},
			err: folder.ErrMaximumDepthReached,
		},
		{
			name: "should return error when title is empty",
			input: input{
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "",
					},
				},
				name: "foo",
			},
			err: dashboards.ErrFolderTitleEmpty,
		},
		{
			name: "should return error if folder is a parent of itself",
			input: input{
				annotations: map[string]string{utils.AnnoKeyFolder: "myself"},
				obj: &folders.Folder{
					Spec: folders.FolderSpec{
						Title: "title",
					},
				},
				name: "myself",
			},
			err: folder.ErrFolderCannotBeParentOfItself,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := (grafanarest.Storage)(nil)
			m := &mock.Mock{}
			us := storageMock{m, s}

			b := &FolderAPIBuilder{
				gv:         resourceInfo.GroupVersion(),
				features:   nil,
				namespacer: func(_ int64) string { return "123" },
				folderSvc:  foldertest.NewFakeService(),
				storage:    us,
				parents:    newParentsGetter(us, 2), // Max Depth of 2
			}

			tt.input.obj.Name = tt.input.name
			tt.input.obj.Annotations = tt.input.annotations

			if tt.setupFn != nil {
				tt.setupFn(m)
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.input.obj,
				nil,
				folders.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"CREATE",
				nil,
				true,
				&user.SignedInUser{},
			), nil)

			if tt.err == nil {
				require.NoError(t, err)
			} else {
				require.ErrorIs(t, err, tt.err)
				return
			}
		})
	}
}

func TestFolderAPIBuilder_Validate_Delete(t *testing.T) {
	tests := []struct {
		name          string
		statsResponse *resourcepb.ResourceStatsResponse_Stats
		wantErr       bool
	}{
		{
			name:          "should allow deletion when folder is empty",
			statsResponse: &resourcepb.ResourceStatsResponse_Stats{Count: 0},
		},
		{
			name:          "should return folder not empty when the folder is not empty",
			statsResponse: &resourcepb.ResourceStatsResponse_Stats{Count: 2},
			wantErr:       true,
		},
	}

	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}
	sm := searcherMock{Mock: m}

	obj := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "foo",
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "stacks-123",
			Name:      "valid-name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var setupFn = func(m *mock.Mock, stats *resourcepb.ResourceStatsResponse_Stats) {
				m.On("GetStats", mock.Anything, &resourcepb.ResourceStatsRequest{Namespace: obj.Namespace, Folder: obj.Name}).Return(
					&resourcepb.ResourceStatsResponse{Stats: []*resourcepb.ResourceStatsResponse_Stats{stats}},
					nil,
				).Once()
			}

			setupFn(m, tt.statsResponse)

			b := &FolderAPIBuilder{
				gv:         resourceInfo.GroupVersion(),
				features:   nil,
				namespacer: func(_ int64) string { return "123" },
				folderSvc:  foldertest.NewFakeService(),
				storage:    us,
				searcher:   sm,
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				obj,
				nil,
				folders.SchemeGroupVersion.WithKind("folder"),
				obj.Namespace,
				obj.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"DELETE",
				nil,
				true,
				&user.SignedInUser{},
			),
				nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Validate_Update(t *testing.T) {
	var circularObj = &folders.Folder{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   "stacks-123",
			Name:        "new-parent",
			Annotations: map[string]string{"grafana.app/folder": "new-parent"},
		},
	}

	tests := []struct {
		name       string
		updatedObj *folders.Folder
		expected   *folders.Folder
		setupFn    func(*mock.Mock)
		wantErr    bool
	}{
		{
			name: "should allow updating a folder spec",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "different title",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
			expected: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "different title",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
		},
		{
			name: "updated title should not be empty",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
				},
			},
			wantErr: true,
		},
		{
			name: "should allow moving to a valid parent",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "new-parent"},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, "new-parent", mock.Anything).Return(
					&folders.Folder{},
					nil).Once()
			},
		},
		{
			name: "should not allow moving to a k6 folder",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": accesscontrol.K6FolderUID},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, accesscontrol.K6FolderUID, mock.Anything).Return(
					&folders.Folder{},
					nil).Once()
			},
			wantErr: true,
		},
		{
			name: "should not allow moving to a folder that is too deep",
			updatedObj: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				ObjectMeta: metav1.ObjectMeta{
					Namespace:   "stacks-123",
					Name:        "valid-name",
					Annotations: map[string]string{"grafana.app/folder": "new-parent"},
				},
			},
			setupFn: func(m *mock.Mock) {
				m.On("Get", mock.Anything, "new-parent", mock.Anything).Return(
					circularObj,
					nil)
			},
			wantErr: true,
		},
	}

	obj := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "foo",
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   "stacks-123",
			Name:        "valid-name",
			Annotations: map[string]string{"grafana.app/folder": "valid-parent"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := (grafanarest.Storage)(nil)
			m := &mock.Mock{}
			us := storageMock{m, s}
			sm := searcherMock{Mock: m}
			if tt.setupFn != nil {
				tt.setupFn(m)
			}

			b := &FolderAPIBuilder{
				gv:         resourceInfo.GroupVersion(),
				features:   nil,
				namespacer: func(_ int64) string { return "123" },
				folderSvc:  foldertest.NewFakeService(),
				storage:    us,
				searcher:   sm,
				parents:    newParentsGetter(us, 2), // Max Depth of 2
			}

			err := b.Validate(context.Background(), admission.NewAttributesRecord(
				tt.updatedObj,
				obj,
				folders.SchemeGroupVersion.WithKind("folder"),
				tt.updatedObj.Namespace,
				tt.updatedObj.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"UPDATE",
				nil,
				true,
				&user.SignedInUser{},
			),
				nil)

			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
		})
	}
}

func TestFolderAPIBuilder_Mutate_Create(t *testing.T) {
	tests := []struct {
		name     string
		input    *folders.Folder
		expected *folders.Folder
		wantErr  bool
	}{
		{
			name: "should trim a title",
			input: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "  foo  ",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			expected: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
		},
		{
			name: "should return error if title doesnt exist",
			input: &folders.Folder{
				Spec: folders.FolderSpec{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
		{
			name: "should return error if spec doesnt exist",
			input: &folders.Folder{
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			s := (grafanarest.Storage)(nil)
			m := &mock.Mock{}
			m.On("Get", context.Background(), tt.input.Name, &metav1.GetOptions{}).Return(tt.input, nil)
			us := storageMock{m, s}
			sm := searcherMock{Mock: m}
			b := &FolderAPIBuilder{
				gv:         resourceInfo.GroupVersion(),
				features:   nil,
				namespacer: func(_ int64) string { return "123" },
				folderSvc:  foldertest.NewFakeService(),
				storage:    us,
				searcher:   sm,
				parents:    newParentsGetter(us, 2), // Max Depth of 2
			}
			admAttr := admission.NewAttributesRecord(
				tt.input,
				nil,
				folders.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"CREATE",
				nil,
				true,
				&user.SignedInUser{},
			)

			err := b.Validate(context.Background(), admAttr, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			err = b.Mutate(context.Background(), admAttr, nil)
			require.NoError(t, err)
			require.Equal(t, tt.input, tt.expected)
		})
	}
}

func TestFolderAPIBuilder_Mutate_Update(t *testing.T) {
	existingObj := &folders.Folder{
		Spec: folders.FolderSpec{
			Title: "some title",
		},
		TypeMeta: metav1.TypeMeta{
			Kind: "Folder",
		},
		ObjectMeta: metav1.ObjectMeta{
			Name: "valid-name",
		},
	}
	tests := []struct {
		name     string
		input    *folders.Folder
		expected *folders.Folder
		wantErr  bool
	}{
		{
			name: "should trim a title",
			input: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "  foo  ",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			expected: &folders.Folder{
				Spec: folders.FolderSpec{
					Title: "foo",
				},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
		},
		{
			name: "should return error if title doesnt exist",
			input: &folders.Folder{
				Spec: folders.FolderSpec{},
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
		{
			name: "should return error if spec doesnt exist",
			input: &folders.Folder{
				TypeMeta: metav1.TypeMeta{
					Kind: "Folder",
				},
				ObjectMeta: metav1.ObjectMeta{
					Name: "valid-name",
				},
			},
			wantErr: true,
		},
	}
	s := (grafanarest.Storage)(nil)
	m := &mock.Mock{}
	us := storageMock{m, s}
	sm := searcherMock{Mock: m}
	b := &FolderAPIBuilder{
		gv:         resourceInfo.GroupVersion(),
		features:   nil,
		namespacer: func(_ int64) string { return "123" },
		folderSvc:  foldertest.NewFakeService(),
		storage:    us,
		searcher:   sm,
		parents:    newParentsGetter(us, 2), // Max Depth of 2
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			admAttr := admission.NewAttributesRecord(
				tt.input,
				existingObj,
				folders.SchemeGroupVersion.WithKind("folder"),
				"stacks-123",
				tt.input.Name,
				folders.SchemeGroupVersion.WithResource("folders"),
				"",
				"UPDATE",
				nil,
				true,
				&user.SignedInUser{},
			)

			err := b.Validate(context.Background(), admAttr, nil)
			if tt.wantErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)

			err = b.Mutate(context.Background(), admAttr, nil)
			require.NoError(t, err)
			require.Equal(t, tt.input, tt.expected)
		})
	}
}
