package resources

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	dashboardV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashboardV1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestParser(t *testing.T) {
	clients := NewMockResourceClients(t)
	clients.On("ForKind", mock.Anything, dashboardV0.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV0.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()
	clients.On("ForKind", mock.Anything, dashboardV1.DashboardResourceInfo.GroupVersionKind()).
		Return(nil, dashboardV1.DashboardResourceInfo.GroupVersionResource(), nil).Maybe()

	parser := &parser{
		repo: provisioning.ResourceRepositoryInfo{
			Type:      provisioning.LocalRepositoryType,
			Namespace: "xxx",
			Name:      "repo",
		},
		clients: clients,
		config: &provisioning.Repository{
			ObjectMeta: metav1.ObjectMeta{
				Namespace: "xxx",
				Name:      "repo",
			},
			Spec: provisioning.RepositorySpec{
				Type: provisioning.LocalRepositoryType,
				Sync: provisioning.SyncOptions{Target: provisioning.SyncTargetTypeFolder},
			},
		},
	}

	t.Run("invalid input", func(t *testing.T) {
		_, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte("hello"), // not a real resource
		})
		require.Error(t, err)
		// Check that it's a ResourceValidationError
		var resourceErr *ResourceValidationError
		require.ErrorAs(t, err, &resourceErr, "error should be a ResourceValidationError")
		require.Contains(t, err.Error(), "resource validation failed")
	})

	t.Run("dashboard parsing (with and without name)", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-v0
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "test-v0", dash.Obj.GetName())
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)

		// Now try again without a name
		_, err = parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: ` + dashboardV1.APIVERSION + `
kind: Dashboard
spec:
  title: Test dashboard
`),
		})
		require.EqualError(t, err, "name.metadata.name: Required value: missing name in resource")
	})

	t.Run("generate name will generate a name", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  generateName: rand-
spec:
  title: Test dashboard
`),
		})
		require.NoError(t, err)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.True(t, strings.HasPrefix(dash.Obj.GetName(), "rand-"), "set name")
	})

	t.Run("dashboard classic format", func(t *testing.T) {
		dash, err := parser.Parse(context.Background(), &repository.FileInfo{
			Data: []byte(`{ "uid": "test", "schemaVersion": 30, "panels": [], "tags": [] }`),
		})
		require.NoError(t, err)
		require.Equal(t, "test", dash.Obj.GetName())
		require.Equal(t, provisioning.ClassicDashboard, dash.Classic)
		require.Equal(t, "dashboard.grafana.app", dash.GVK.Group)
		require.Equal(t, "v0alpha1", dash.GVK.Version)
		require.Equal(t, "dashboard.grafana.app", dash.GVR.Group)
		require.Equal(t, "v0alpha1", dash.GVR.Version)
	})

	t.Run("validate proper folder metadata is set", func(t *testing.T) {
		testCases := []struct {
			name           string
			filePath       string
			expectedFolder string
		}{
			{
				name:           "file in subdirectory should use parsed folder ID",
				filePath:       "team-a/testing-valid-dashboard.json",
				expectedFolder: ParseFolder("team-a/", "repo").ID,
			},
			{
				name:           "file in first-level directory should use parent folder id",
				filePath:       "testing-valid-dashboard.json",
				expectedFolder: parser.repo.Name,
			},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				dash, err := parser.Parse(context.Background(), &repository.FileInfo{
					Path: tc.filePath,
					Data: []byte(`apiVersion: dashboard.grafana.app/v0alpha1
kind: Dashboard
metadata:
  name: test-dashboard
spec:
  title: Test dashboard
`),
				})
				require.NoError(t, err)
				require.Equal(t, tc.expectedFolder, dash.Meta.GetFolder(), "folder should match expected")
				annotations := dash.Obj.GetAnnotations()
				require.NotNil(t, annotations, "annotations should not be nil")
				require.Equal(t, tc.expectedFolder, annotations["grafana.app/folder"], "folder annotation should match expected")
			})
		}
	})
}

func TestResourceValidationError(t *testing.T) {
	t.Run("Error method returns formatted message with underlying error", func(t *testing.T) {
		underlyingErr := errors.New("underlying error")
		validationErr := NewResourceValidationError(underlyingErr)

		require.Equal(t, "resource validation failed: underlying error", validationErr.Error())
	})

	t.Run("Error method returns message without underlying error", func(t *testing.T) {
		validationErr := NewResourceValidationError(nil)

		// Error() includes the BadRequest error in the output, so it will be longer than just the message
		require.Contains(t, validationErr.Error(), "resource validation failed")
	})

	t.Run("Unwrap returns underlying error", func(t *testing.T) {
		underlyingErr := errors.New("underlying error")
		validationErr := NewResourceValidationError(underlyingErr)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)
		// The unwrapped error should be a BadRequest error created by NewResourceValidationError
		require.Error(t, unwrapped)
	})

	t.Run("NewResourceValidationError creates BadRequest error", func(t *testing.T) {
		underlyingErr := errors.New("test error")
		validationErr := NewResourceValidationError(underlyingErr)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)

		// Check that the unwrapped error is a BadRequest
		var badRequestErr *apierrors.StatusError
		require.ErrorAs(t, unwrapped, &badRequestErr, "unwrapped error should be a StatusError (BadRequest)")
		require.True(t, apierrors.IsBadRequest(unwrapped), "unwrapped error should be a BadRequest")
	})

	t.Run("errors.Is finds underlying BadRequest error", func(t *testing.T) {
		underlyingErr := errors.New("test error")
		validationErr := NewResourceValidationError(underlyingErr)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)

		// errors.Is should work with the unwrapped BadRequest error
		require.True(t, errors.Is(validationErr, unwrapped), "errors.Is should find the unwrapped BadRequest error")

		// Also test with apierrors.IsBadRequest
		require.True(t, apierrors.IsBadRequest(validationErr), "apierrors.IsBadRequest should work on the validation error")
	})

	t.Run("errors.As extracts ResourceValidationError", func(t *testing.T) {
		underlyingErr := errors.New("test error")
		validationErr := NewResourceValidationError(underlyingErr)

		var extractedErr *ResourceValidationError
		require.True(t, errors.As(validationErr, &extractedErr))
		require.NotNil(t, extractedErr)
		require.Equal(t, validationErr.Err, extractedErr.Err)
	})

	t.Run("errors.As returns false for non-ResourceValidationError", func(t *testing.T) {
		regularErr := errors.New("regular error")

		var extractedErr *ResourceValidationError
		require.False(t, errors.As(regularErr, &extractedErr))
		require.Nil(t, extractedErr)
	})

	t.Run("NewResourceValidationError with nil error still creates BadRequest", func(t *testing.T) {
		validationErr := NewResourceValidationError(nil)

		unwrapped := validationErr.Unwrap()
		require.NotNil(t, unwrapped)

		require.True(t, apierrors.IsBadRequest(unwrapped), "unwrapped error should be a BadRequest even when input error is nil")
		require.True(t, apierrors.IsBadRequest(validationErr), "validation error should be recognized as BadRequest")
	})
}
