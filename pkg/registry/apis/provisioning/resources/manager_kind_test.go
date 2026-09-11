package resources

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func TestCheckResourceManagerKind(t *testing.T) {
	for _, tt := range []struct {
		name     string
		manager  *utils.ManagerProperties
		getErr   error
		conflict bool
	}{
		{name: "editable Terraform resource", manager: &utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider", AllowsEdits: true}, conflict: true},
		{name: "non-editable Terraform resource", manager: &utils.ManagerProperties{Kind: utils.ManagerKindTerraform, Identity: "terraform-provider"}, conflict: true},
		{name: "empty legacy manager identity", manager: &utils.ManagerProperties{Kind: utils.ManagerKindClassicFP}, conflict: true}, //nolint:staticcheck
		{name: "same repository", manager: &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: testRepoName}},
		{name: "manager identity conflict", manager: &utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "another-repo", AllowsEdits: true}},
		{name: "unmanaged resource"},
		{name: "missing resource", getErr: apierrors.NewNotFound(schema.GroupResource{}, "test-resource")},
		{name: "forbidden lookup", getErr: apierrors.NewForbidden(schema.GroupResource{}, "test-resource", fmt.Errorf("access denied"))},
		{name: "server failure", getErr: apierrors.NewInternalError(fmt.Errorf("server failure"))},
	} {
		t.Run(tt.name, func(t *testing.T) {
			repo := repository.NewMockReaderWriter(t)
			parser := NewMockParser(t)
			client := &MockDynamicResourceInterface{}
			parsed := mustBuildParsedResource("test-resource", client)
			info := &repository.FileInfo{Path: "nested/resource.json", Data: []byte(`{}`)}
			repo.On("Read", mock.Anything, info.Path, "ref").Return(info, nil).Once()
			parser.On("Parse", mock.Anything, info).Return(parsed, nil).Once()
			existing := parsed.Obj.DeepCopy()
			if tt.manager != nil {
				meta, err := utils.MetaAccessor(existing)
				require.NoError(t, err)
				meta.SetManagerProperties(*tt.manager)
			}
			before := existing.DeepCopy()
			if tt.getErr != nil {
				existing = nil
			}
			client.On("Get", mock.Anything, "test-resource", metav1.GetOptions{}, mock.Anything).Return(existing, tt.getErr).Once()
			// No folder manager or write expectations: inspecting a nested file must not create its parents or write the resource.
			manager := NewResourcesManager(repo, nil, parser, nil)
			name, gvk, size, err := manager.CheckResourceManagerKind(context.Background(), info.Path, "ref")
			require.Equal(t, "test-resource", name)
			require.Equal(t, parsed.GVK, gvk)
			require.Equal(t, len(info.Data), size)
			if tt.conflict {
				require.True(t, utils.IsResourceManagerKindConflictError(err))
				want := utils.NewResourceManagerKindConflictError(*tt.manager, utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: parsed.Repo.Name})
				require.EqualError(t, err, want.Error())
			} else if tt.getErr != nil && !apierrors.IsNotFound(tt.getErr) {
				require.ErrorIs(t, err, tt.getErr)
				require.False(t, utils.IsResourceManagerKindConflictError(err))
			} else {
				require.NoError(t, err)
			}
			if existing != nil {
				require.Equal(t, before, existing)
			}
			client.AssertExpectations(t)
		})
	}
}

func TestCheckResourceManagerKind_FileErrors(t *testing.T) {
	for _, parseFailure := range []bool{false, true} {
		t.Run(fmt.Sprintf("parse=%t", parseFailure), func(t *testing.T) {
			repo := repository.NewMockReaderWriter(t)
			parser := NewMockParser(t)
			failure := fmt.Errorf("file unavailable")
			info := &repository.FileInfo{Path: "resource.json", Data: []byte(`{}`)}
			if parseFailure {
				repo.On("Read", mock.Anything, info.Path, "ref").Return(info, nil)
				parser.On("Parse", mock.Anything, info).Return(nil, failure)
			} else {
				repo.On("Read", mock.Anything, info.Path, "ref").Return(nil, failure)
			}
			manager := NewResourcesManager(repo, nil, parser, nil)
			_, _, _, err := manager.CheckResourceManagerKind(context.Background(), info.Path, "ref")
			require.ErrorIs(t, err, failure)
		})
	}
}
