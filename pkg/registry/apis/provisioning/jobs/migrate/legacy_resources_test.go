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
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	provisioning "github.com/grafana/grafana/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/dashboard/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/jobs"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/repository"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/resources/signature"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func TestLegacyResourcesMigrator_Migrate(t *testing.T) {
	t.Run("should fail when parser factory fails", func(t *testing.T) {
		mockParserFactory := resources.NewMockParserFactory(t)
		mockParserFactory.On("GetParser", mock.Anything, mock.Anything).
			Return(nil, errors.New("parser factory error"))

		signerFactory := signature.NewMockSignerFactory(t)

		migrator := NewLegacyResourcesMigrator(
			nil,
			mockParserFactory,
			nil,
			nil,
			signerFactory,
		)

		err := migrator.Migrate(context.Background(), nil, "test-namespace", provisioning.MigrateJobOptions{}, jobs.NewMockJobProgressRecorder(t))
		require.Error(t, err)
		require.EqualError(t, err, "get parser: parser factory error")

		mockParserFactory.AssertExpectations(t)
	})

	t.Run("should fail when repository resources factory fails", func(t *testing.T) {
		mockParserFactory := resources.NewMockParserFactory(t)
		mockParserFactory.On("GetParser", mock.Anything, mock.Anything).
			Return(resources.NewMockParser(t), nil)

		mockRepoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockRepoResourcesFactory.On("Client", mock.Anything, mock.Anything, mock.Anything).
			Return(nil, errors.New("repo resources factory error"))
		signerFactory := signature.NewMockSignerFactory(t)

		migrator := NewLegacyResourcesMigrator(
			mockRepoResourcesFactory,
			mockParserFactory,
			nil,
			nil,
			signerFactory,
		)

		err := migrator.Migrate(context.Background(), nil, "test-namespace", provisioning.MigrateJobOptions{}, jobs.NewMockJobProgressRecorder(t))
		require.Error(t, err)
		require.EqualError(t, err, "get repository resources: repo resources factory error")

		mockParserFactory.AssertExpectations(t)
		mockRepoResourcesFactory.AssertExpectations(t)
	})

	t.Run("should fail when folder migrator fails", func(t *testing.T) {
		mockParserFactory := resources.NewMockParserFactory(t)
		mockParserFactory.On("GetParser", mock.Anything, mock.Anything).
			Return(resources.NewMockParser(t), nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockRepoResourcesFactory.On("Client", mock.Anything, mock.Anything, mock.Anything).
			Return(mockRepoResources, nil)

		mockFolderMigrator := NewMockLegacyFoldersMigrator(t)
		mockFolderMigrator.On("Migrate", mock.Anything, "test-namespace", mockRepoResources, mock.Anything).
			Return(errors.New("folder migrator error"))

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()

		signer := signature.NewMockSigner(t)
		signerFactory := signature.NewMockSignerFactory(t)
		signerFactory.On("New", mock.Anything, mock.Anything).
			Return(signer, nil)

		migrator := NewLegacyResourcesMigrator(
			mockRepoResourcesFactory,
			mockParserFactory,
			nil,
			mockFolderMigrator,
			signerFactory,
		)

		err := migrator.Migrate(context.Background(), nil, "test-namespace", provisioning.MigrateJobOptions{}, progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "migrate folders from SQL")

		mockParserFactory.AssertExpectations(t)
		mockRepoResourcesFactory.AssertExpectations(t)
		mockFolderMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should fail when resource migration fails", func(t *testing.T) {
		mockParserFactory := resources.NewMockParserFactory(t)
		mockParserFactory.On("GetParser", mock.Anything, mock.Anything).
			Return(resources.NewMockParser(t), nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockRepoResourcesFactory.On("Client", mock.Anything, mock.Anything, mock.Anything).
			Return(mockRepoResources, nil)

		mockFolderMigrator := NewMockLegacyFoldersMigrator(t)
		mockFolderMigrator.On("Migrate", mock.Anything, "test-namespace", mockRepoResources, mock.Anything).
			Return(nil)

		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, errors.New("legacy migrator error"))

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()

		signer := signature.NewMockSigner(t)
		signerFactory := signature.NewMockSignerFactory(t)
		signerFactory.On("New", mock.Anything, mock.Anything).
			Return(signer, nil)

		migrator := NewLegacyResourcesMigrator(
			mockRepoResourcesFactory,
			mockParserFactory,
			mockLegacyMigrator,
			mockFolderMigrator,
			signerFactory,
		)

		err := migrator.Migrate(context.Background(), nil, "test-namespace", provisioning.MigrateJobOptions{}, progress)
		require.Error(t, err)
		require.Contains(t, err.Error(), "migrate resource")

		mockParserFactory.AssertExpectations(t)
		mockRepoResourcesFactory.AssertExpectations(t)
		mockFolderMigrator.AssertExpectations(t)
		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should fail when signer factory fails", func(t *testing.T) {
		mockParserFactory := resources.NewMockParserFactory(t)
		mockParserFactory.On("GetParser", mock.Anything, mock.Anything).
			Return(resources.NewMockParser(t), nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockRepoResourcesFactory.On("Client", mock.Anything, mock.Anything, mock.Anything).
			Return(mockRepoResources, nil)

		mockFolderMigrator := NewMockLegacyFoldersMigrator(t)
		mockSignerFactory := signature.NewMockSignerFactory(t)
		mockSignerFactory.On("New", mock.Anything, signature.SignOptions{
			Namespace: "test-namespace",
			History:   true,
		}).Return(nil, fmt.Errorf("signer factory error"))

		progress := jobs.NewMockJobProgressRecorder(t)
		migrator := NewLegacyResourcesMigrator(
			mockRepoResourcesFactory,
			mockParserFactory,
			nil,
			mockFolderMigrator,
			mockSignerFactory,
		)

		err := migrator.Migrate(context.Background(), nil, "test-namespace", provisioning.MigrateJobOptions{
			History: true,
		}, progress)
		require.Error(t, err)
		require.EqualError(t, err, "get signer: signer factory error")

		mockParserFactory.AssertExpectations(t)
		mockRepoResourcesFactory.AssertExpectations(t)
		mockFolderMigrator.AssertExpectations(t)
		mockSignerFactory.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should successfully migrate all resources", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		mockParserFactory := resources.NewMockParserFactory(t)
		mockParserFactory.On("GetParser", mock.Anything, mock.Anything).
			Return(mockParser, nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResourcesFactory := resources.NewMockRepositoryResourcesFactory(t)
		mockRepoResourcesFactory.On("Client", mock.Anything, mock.Anything, mock.Anything).
			Return(mockRepoResources, nil)

		mockFolderMigrator := NewMockLegacyFoldersMigrator(t)
		mockFolderMigrator.On("Migrate", mock.Anything, "test-namespace", mockRepoResources, mock.Anything).
			Return(nil)

		mockSigner := signature.NewMockSigner(t)
		mockSignerFactory := signature.NewMockSignerFactory(t)
		mockSignerFactory.On("New", mock.Anything, signature.SignOptions{
			Namespace: "test-namespace",
			History:   true,
		}).Return(mockSigner, nil)

		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, nil).Once() // Count phase
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return !opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{
			Summary: []*resource.BulkResponse_Summary{
				{
					Group:    "test.grafana.app",
					Resource: "tests",
					Count:    10,
					History:  5,
				},
			},
		}, nil).Once() // Migration phase

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, "migrate folders from SQL").Return()
		progress.On("SetMessage", mock.Anything, "migrate resources from SQL").Return()
		progress.On("SetMessage", mock.Anything, "migrate dashboards resource").Return()

		migrator := NewLegacyResourcesMigrator(
			mockRepoResourcesFactory,
			mockParserFactory,
			mockLegacyMigrator,
			mockFolderMigrator,
			mockSignerFactory,
		)

		err := migrator.Migrate(context.Background(), nil, "test-namespace", provisioning.MigrateJobOptions{
			History: true,
		}, progress)
		require.NoError(t, err)

		mockParserFactory.AssertExpectations(t)
		mockRepoResourcesFactory.AssertExpectations(t)
		mockFolderMigrator.AssertExpectations(t)
		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
}

func TestLegacyResourceResourceMigrator_Write(t *testing.T) {
	t.Run("should fail when parser fails", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(nil, errors.New("parser error"))

		progress := jobs.NewMockJobProgressRecorder(t)

		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err := migrator.Write(context.Background(), &resource.ResourceKey{}, []byte("test"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "unmarshal unstructured")

		mockParser.AssertExpectations(t)
	})

	t.Run("records error when create resource file fails", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		obj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)

		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(&resources.ParsedResource{
				Meta: meta,
				Obj:  obj,
			}, nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything).
			Return("", errors.New("create file error"))

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionCreated &&
				result.Name == "test" &&
				result.Error != nil &&
				result.Error.Error() == "create file error"
		})).Return()
		progress.On("TooManyErrors").Return(nil)

		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			mockRepoResources,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err = migrator.Write(context.Background(), &resource.ResourceKey{}, []byte("test"))
		require.NoError(t, err) // Error is recorded but not returned

		mockParser.AssertExpectations(t)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should fail when signer fails", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		obj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)

		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(&resources.ParsedResource{
				Meta: meta,
				Obj:  obj,
			}, nil)

		mockSigner := signature.NewMockSigner(t)
		mockSigner.On("Sign", mock.Anything, meta).
			Return(nil, errors.New("signing error"))

		progress := jobs.NewMockJobProgressRecorder(t)
		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			mockSigner,
		)

		err = migrator.Write(context.Background(), &resource.ResourceKey{}, []byte("test"))
		require.Error(t, err)
		require.EqualError(t, err, "add author signature: signing error")

		mockParser.AssertExpectations(t)
		mockSigner.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should successfully add author signature", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		obj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)

		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(&resources.ParsedResource{
				Meta: meta,
				Obj:  obj,
			}, nil)

		mockSigner := signature.NewMockSigner(t)
		signedCtx := repository.WithAuthorSignature(context.Background(), repository.CommitSignature{
			Name:  "test-user",
			Email: "test@example.com",
		})
		mockSigner.On("Sign", mock.Anything, meta).
			Return(signedCtx, nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.On("WriteResourceFileFromObject", signedCtx, mock.Anything, mock.Anything).
			Return("test/path", nil)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionCreated &&
				result.Name == "test" &&
				result.Error == nil &&
				result.Path == "test/path"
		})).Return()
		progress.On("TooManyErrors").Return(nil)

		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			mockRepoResources,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			mockSigner,
		)

		err = migrator.Write(context.Background(), &resource.ResourceKey{}, []byte("test"))
		require.NoError(t, err)

		mockParser.AssertExpectations(t)
		mockSigner.AssertExpectations(t)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should maintain history", func(t *testing.T) {
		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(nil)

		mockParser := resources.NewMockParser(t)
		obj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
				},
			},
		}
		meta, _ := utils.MetaAccessor(obj)
		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(&resources.ParsedResource{
				Meta: meta,
				Obj:  obj,
			}, nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		writeResourceFileFromObject := mockRepoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, mock.Anything)

		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			mockRepoResources,
			progress,
			provisioning.MigrateJobOptions{
				History: true,
			},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		writeResourceFileFromObject.Return("aaaa.json", nil)
		err := migrator.Write(context.Background(), &resource.ResourceKey{}, []byte(""))
		require.NoError(t, err)
		require.Equal(t, "aaaa.json", migrator.history["test"], "kept track of the old files")

		// Change the result file name
		writeResourceFileFromObject.Return("bbbb.json", nil)
		mockRepoResources.On("RemoveResourceFromFile", mock.Anything, "aaaa.json", "").
			Return("", schema.GroupVersionKind{}, nil).Once()

		err = migrator.Write(context.Background(), &resource.ResourceKey{}, []byte(""))
		require.NoError(t, err)
		require.Equal(t, "bbbb.json", migrator.history["test"], "kept track of the old files")

		mockParser.AssertExpectations(t)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should successfully write resource", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		obj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)
		meta.SetManagerProperties(utils.ManagerProperties{
			Kind:        utils.ManagerKindRepo,
			Identity:    "test",
			AllowsEdits: true,
			Suspended:   false,
		})
		meta.SetSourceProperties(utils.SourceProperties{
			Path:            "test",
			Checksum:        "test",
			TimestampMillis: 1234567890,
		})

		mockParser.On("Parse", mock.Anything, mock.MatchedBy(func(info *repository.FileInfo) bool {
			return info != nil && info.Path == "" && string(info.Data) == "test"
		})).
			Return(&resources.ParsedResource{
				Meta: meta,
				Obj:  obj,
			}, nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.On("WriteResourceFileFromObject", mock.Anything, mock.MatchedBy(func(obj *unstructured.Unstructured) bool {
			if obj == nil {
				return false
			}
			if obj.GetName() != "test" {
				return false
			}

			meta, err := utils.MetaAccessor(obj)
			require.NoError(t, err)
			managerProps, _ := meta.GetManagerProperties()
			sourceProps, _ := meta.GetSourceProperties()

			return assert.Zero(t, sourceProps) && assert.Zero(t, managerProps)
		}), resources.WriteOptions{
			Path: "",
			Ref:  "",
		}).
			Return("test/path", nil)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.MatchedBy(func(result jobs.JobResourceResult) bool {
			return result.Action == repository.FileActionCreated &&
				result.Name == "test" &&
				result.Error == nil &&
				result.Resource == "tests" &&
				result.Group == "test.grafana.app" &&
				result.Path == "test/path"
		})).Return()
		progress.On("TooManyErrors").Return(nil)

		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			mockRepoResources,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err = migrator.Write(context.Background(), &resource.ResourceKey{}, []byte("test"))
		require.NoError(t, err)

		mockParser.AssertExpectations(t)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should fail when too many errors", func(t *testing.T) {
		mockParser := resources.NewMockParser(t)
		obj := &unstructured.Unstructured{
			Object: map[string]any{
				"metadata": map[string]any{
					"name": "test",
				},
			},
		}
		meta, err := utils.MetaAccessor(obj)
		require.NoError(t, err)

		mockParser.On("Parse", mock.Anything, mock.Anything).
			Return(&resources.ParsedResource{
				Meta: meta,
				Obj:  obj,
			}, nil)

		mockRepoResources := resources.NewMockRepositoryResources(t)
		mockRepoResources.On("WriteResourceFileFromObject", mock.Anything, mock.Anything, resources.WriteOptions{}).
			Return("test/path", nil)

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("Record", mock.Anything, mock.Anything).Return()
		progress.On("TooManyErrors").Return(errors.New("too many errors"))

		migrator := NewLegacyResourceMigrator(
			nil,
			mockParser,
			mockRepoResources,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err = migrator.Write(context.Background(), &resource.ResourceKey{}, []byte("test"))
		require.EqualError(t, err, "too many errors")

		mockParser.AssertExpectations(t)
		mockRepoResources.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
}

func TestLegacyResourceResourceMigrator_Migrate(t *testing.T) {
	t.Run("should fail when legacy migrate count fails", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, errors.New("count error"))

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()

		migrator := NewLegacyResourceMigrator(
			mockLegacyMigrator,
			nil,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err := migrator.Migrate(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "unable to count legacy items")

		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should fail when legacy migrate write fails", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, nil).Once() // Count phase
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return !opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, errors.New("write error")).Once() // Write phase

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()

		migrator := NewLegacyResourceMigrator(
			mockLegacyMigrator,
			nil,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "test-resources"},
			signature.NewGrafanaSigner(),
		)

		err := migrator.Migrate(context.Background())
		require.Error(t, err)
		require.Contains(t, err.Error(), "migrate legacy test-resources: write error")

		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})

	t.Run("should successfully migrate resource", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, nil).Once() // Count phase
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return !opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, nil).Once() // Write phase

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()

		migrator := NewLegacyResourceMigrator(
			mockLegacyMigrator,
			nil,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err := migrator.Migrate(context.Background())
		require.NoError(t, err)

		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
	t.Run("should set total to history if history is greater than count", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{
			Summary: []*resource.BulkResponse_Summary{
				{
					Group:    "test.grafana.app",
					Resource: "tests",
					Count:    1,
					History:  100,
				},
			},
		}, nil).Once() // Count phase
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return !opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, nil).Once() // Write phase

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("SetTotal", mock.Anything, 100).Return()

		migrator := NewLegacyResourceMigrator(
			mockLegacyMigrator,
			nil,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signature.NewGrafanaSigner(),
		)

		err := migrator.Migrate(context.Background())
		require.NoError(t, err)

		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
	t.Run("should set total to count if history is less than count", func(t *testing.T) {
		mockLegacyMigrator := legacy.NewMockLegacyMigrator(t)
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{
			Summary: []*resource.BulkResponse_Summary{
				{
					Group:    "test.grafana.app",
					Resource: "tests",
					Count:    200,
					History:  1,
				},
			},
		}, nil).Once() // Count phase
		mockLegacyMigrator.On("Migrate", mock.Anything, mock.MatchedBy(func(opts legacy.MigrateOptions) bool {
			return !opts.OnlyCount && opts.Namespace == "test-namespace"
		})).Return(&resource.BulkResponse{}, nil).Once() // Write phase

		progress := jobs.NewMockJobProgressRecorder(t)
		progress.On("SetMessage", mock.Anything, mock.Anything).Return()
		progress.On("SetTotal", mock.Anything, 200).Return()
		signer := signature.NewMockSigner(t)

		migrator := NewLegacyResourceMigrator(
			mockLegacyMigrator,
			nil,
			nil,
			progress,
			provisioning.MigrateJobOptions{},
			"test-namespace",
			schema.GroupResource{Group: "test.grafana.app", Resource: "tests"},
			signer,
		)

		err := migrator.Migrate(context.Background())
		require.NoError(t, err)

		mockLegacyMigrator.AssertExpectations(t)
		progress.AssertExpectations(t)
	})
}

func TestLegacyResourceResourceMigrator_Close(t *testing.T) {
	t.Run("should return nil error", func(t *testing.T) {
		migrator := &legacyResourceResourceMigrator{}
		err := migrator.Close()
		require.NoError(t, err)
	})
}

func TestLegacyResourceResourceMigrator_CloseWithResults(t *testing.T) {
	t.Run("should return empty bulk response and nil error", func(t *testing.T) {
		migrator := &legacyResourceResourceMigrator{}
		response, err := migrator.CloseWithResults()

		require.NoError(t, err)
		require.NotNil(t, response)
		require.IsType(t, &resource.BulkResponse{}, response)
		require.Empty(t, response.Summary)
	})
}
