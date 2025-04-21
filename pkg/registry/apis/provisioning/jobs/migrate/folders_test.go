package migrate

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestLegacyFoldersMigrator_Write(t *testing.T) {
	t.Run("should fail when json is invalid", func(t *testing.T) {
		migrator := NewLegacyFoldersMigrator(legacy.NewMockLegacyMigrator(t))
		err := migrator.Write(context.Background(), nil, []byte("invalid json"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "unmarshal unstructured to JSON")
	})

	t.Run("should fail when too many folders", func(t *testing.T) {
		migrator := NewLegacyFoldersMigrator(legacy.NewMockLegacyMigrator(t))

		// Write more than maxFolders
		for i := 0; i <= maxFolders+1; i++ {
			folder := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "folder.grafana.app/v1alpha1",
					"kind":       "Folder",
					"metadata": map[string]interface{}{
						"name": fmt.Sprintf("test-folder-%d", i),
					},
				},
			}
			folder.SetKind("Folder")
			folder.SetAPIVersion("folder.grafana.app/v1alpha1")

			data, err := folder.MarshalJSON()
			require.NoError(t, err)
			if i == maxFolders+1 {
				err = migrator.Write(context.Background(), nil, data)
				require.Error(t, err)
				require.Equal(t, "too many folders", err.Error())
				return
			}
			err = migrator.Write(context.Background(), nil, data)
			require.NoError(t, err)
		}
	})

	t.Run("should add folder to tree", func(t *testing.T) {
		migrator := NewLegacyFoldersMigrator(legacy.NewMockLegacyMigrator(t))
		folder := &unstructured.Unstructured{
			Object: map[string]interface{}{
				"apiVersion": "folder.grafana.app/v1alpha1",
				"kind":       "Folder",
				"metadata": map[string]interface{}{
					"name": "test-folder",
					"annotations": map[string]interface{}{
						"folder.grafana.app/uid": "test-folder-uid",
					},
				},
			},
		}
		folder.SetKind("Folder")
		folder.SetAPIVersion("folder.grafana.app/v1alpha1")

		data, err := folder.MarshalJSON()
		require.NoError(t, err)

		err = migrator.Write(context.Background(), nil, data)
		require.NoError(t, err)
	})
}

func TestLegacyFoldersMigrator_Migrate(t *testing.T) {
	t.Run("should fail when legacy migrator fails", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.Namespace == "test-namespace" &&
				len(opts.Resources) == 1 &&
				opts.Resources[0] == resources.FolderResource.GroupResource()
		}), mock.Anything).Return(nil, errors.New("migration failed"))

		migrator := NewLegacyFoldersMigrator(mockLegacyMigrator)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "read folders from SQL").Return()

		err := migrator.Migrate(context.Background(), "test-namespace", nil, progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "read folders from SQL: migration failed")
		progress.AssertExpectations(t)
	})

	t.Run("should fail when folder tree creation fails", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.Namespace == "test-namespace" &&
				len(opts.Resources) == 1 &&
				opts.Resources[0] == resources.FolderResource.GroupResource()
		}), mock.Anything).Return(&resource.BulkResponse{}, nil)

		mockRepositoryResources := resources.NewMockRepositoryResources(t)
		mockRepositoryResources.On("EnsureFolderTreeExists", mock.Anything, "", "", mock.Anything, mock.Anything).
			Return(errors.New("folder tree creation failed"))

		migrator := NewLegacyFoldersMigrator(mockLegacyMigrator)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "read folders from SQL").Return()
		progress.On("SetMessage", mock.Anything, "export folders from SQL").Return()

		err := migrator.Migrate(context.Background(), "test-namespace", mockRepositoryResources, progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "export folders from SQL: folder tree creation failed")

		progress.AssertExpectations(t)
	})

	t.Run("should successfully migrate folders", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.Namespace == "test-namespace" &&
				len(opts.Resources) == 1 &&
				opts.Resources[0] == resources.FolderResource.GroupResource()
		}), mock.Anything).Run(func(args mock.Arguments) {
			// Simulate writing a folder through the bulk writer
			opts := args.Get(1).(legacy.MigrateOptions)
			folder := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "folder.grafana.app/v1alpha1",
					"kind":       "Folder",
					"metadata": map[string]interface{}{
						"name": "test-folder",
						"annotations": map[string]interface{}{
							"folder.grafana.app/uid": "test-folder-uid",
						},
					},
				},
			}
			folder.SetKind("Folder")
			folder.SetAPIVersion("folder.grafana.app/v1alpha1")

			data, err := folder.MarshalJSON()
			require.NoError(t, err)
			client, err := opts.Store.BulkProcess(context.Background())
			require.NoError(t, err)
			require.NoError(t, client.Send(&resource.BulkRequest{
				Key:   &resource.ResourceKey{Namespace: "test-namespace", Name: "test-folder"},
				Value: data,
			}))
		}).Return(&resource.BulkResponse{}, nil)

		mockRepositoryResources := resources.NewMockRepositoryResources(t)
		mockRepositoryResources.On("EnsureFolderTreeExists", mock.Anything, "", "", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) {
				callback := args.Get(4).(func(folder resources.Folder, created bool, err error) error)
				err := callback(resources.Folder{
					ID:   "test-folder-uid",
					Path: "/test-folder",
				}, true, nil)
				require.NoError(t, err)
			}).Return(nil)

		migrator := NewLegacyFoldersMigrator(mockLegacyMigrator)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "read folders from SQL").Return()
		progress.On("SetMessage", mock.Anything, "export folders from SQL").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionCreated &&
				result.Name == "test-folder-uid" &&
				result.Resource == resources.FolderResource.Resource &&
				result.Group == resources.FolderResource.Group &&
				result.Path == "/test-folder" &&
				result.Error == nil
		})).Return()

		err := migrator.Migrate(context.Background(), "test-namespace", mockRepositoryResources, progress)
		require.NoError(t, err)
		progress.AssertExpectations(t)
	})
	t.Run("should ignore folders that already exist", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.Namespace == "test-namespace" &&
				len(opts.Resources) == 1 &&
				opts.Resources[0] == resources.FolderResource.GroupResource()
		}), mock.Anything).Run(func(args mock.Arguments) {
			// Simulate writing a folder through the bulk writer
			opts := args.Get(1).(legacy.MigrateOptions)
			folder := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "folder.grafana.app/v1alpha1",
					"kind":       "Folder",
					"metadata": map[string]interface{}{
						"name": "test-folder",
						"annotations": map[string]interface{}{
							"folder.grafana.app/uid": "test-folder-uid",
						},
					},
				},
			}
			folder.SetKind("Folder")
			folder.SetAPIVersion("folder.grafana.app/v1alpha1")

			data, err := folder.MarshalJSON()
			require.NoError(t, err)
			client, err := opts.Store.BulkProcess(context.Background())
			require.NoError(t, err)
			require.NoError(t, client.Send(&resource.BulkRequest{
				Key:   &resource.ResourceKey{Namespace: "test-namespace", Name: "test-folder"},
				Value: data,
			}))
		}).Return(&resource.BulkResponse{}, nil)

		mockRepositoryResources := resources.NewMockRepositoryResources(t)
		mockRepositoryResources.On("EnsureFolderTreeExists", mock.Anything, "", "", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) {
				callback := args.Get(4).(func(folder resources.Folder, created bool, err error) error)
				err := callback(resources.Folder{
					ID:   "test-folder-uid",
					Path: "/test-folder",
				}, false, nil)
				require.NoError(t, err)
			}).Return(nil)

		migrator := NewLegacyFoldersMigrator(mockLegacyMigrator)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "read folders from SQL").Return()
		progress.On("SetMessage", mock.Anything, "export folders from SQL").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionIgnored &&
				result.Name == "test-folder-uid" &&
				result.Resource == resources.FolderResource.Resource &&
				result.Group == resources.FolderResource.Group &&
				result.Path == "/test-folder" &&
				result.Error == nil
		})).Return()

		err := migrator.Migrate(context.Background(), "test-namespace", mockRepositoryResources, progress)
		require.NoError(t, err)
		progress.AssertExpectations(t)
	})
	t.Run("should fail when folder creation fails", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			opts := args.Get(1).(legacy.MigrateOptions)
			folder := &unstructured.Unstructured{
				Object: map[string]interface{}{
					"apiVersion": "folder.grafana.app/v1alpha1",
					"kind":       "Folder",
					"metadata": map[string]interface{}{
						"name": "test-folder",
						"annotations": map[string]interface{}{
							"folder.grafana.app/uid": "test-folder-uid",
						},
					},
				},
			}
			folder.SetKind("Folder")
			folder.SetAPIVersion("folder.grafana.app/v1alpha1")

			data, err := folder.MarshalJSON()
			require.NoError(t, err)
			client, err := opts.Store.BulkProcess(context.Background())
			require.NoError(t, err)
			require.NoError(t, client.Send(&resource.BulkRequest{
				Key:   &resource.ResourceKey{Namespace: "test-namespace", Name: "test-folder"},
				Value: data,
			}))
		}).Return(&resource.BulkResponse{}, nil)

		mockRepositoryResources := resources.NewMockRepositoryResources(t)
		expectedError := errors.New("folder creation failed")
		mockRepositoryResources.On("EnsureFolderTreeExists", mock.Anything, "", "", mock.Anything, mock.Anything).
			Run(func(args mock.Arguments) {
				callback := args.Get(4).(func(folder resources.Folder, created bool, err error) error)
				// Call the callback with an error and return its result
				err := callback(resources.Folder{
					ID:   "test-folder-uid",
					Path: "/test-folder",
				}, true, expectedError)
				require.Equal(t, expectedError, err)
			}).Return(expectedError)

		migrator := NewLegacyFoldersMigrator(mockLegacyMigrator)
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "read folders from SQL").Return()
		progress.On("SetMessage", mock.Anything, "export folders from SQL").Return()
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionCreated &&
				result.Name == "test-folder-uid" &&
				result.Resource == resources.FolderResource.Resource &&
				result.Group == resources.FolderResource.Group &&
				result.Path == "/test-folder" &&
				assert.Equal(t, expectedError, result.Error)
		})).Return()

		err := migrator.Migrate(context.Background(), "test-namespace", mockRepositoryResources, progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "export folders from SQL: folder creation failed")
		progress.AssertExpectations(t)
	})
}

func TestLegacyFoldersMigrator_Close(t *testing.T) {
	t.Run("should close without error", func(t *testing.T) {
		migrator := NewLegacyFoldersMigrator(legacy.NewMockLegacyMigrator(t))
		err := migrator.Close()
		require.NoError(t, err)
	})

	t.Run("should close with results without error", func(t *testing.T) {
		migrator := NewLegacyFoldersMigrator(legacy.NewMockLegacyMigrator(t))
		resp, err := migrator.CloseWithResults()
		require.NoError(t, err)
		require.NotNil(t, resp)
	})
}
