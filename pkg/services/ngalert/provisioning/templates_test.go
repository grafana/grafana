package provisioning

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	notifymerge "github.com/grafana/grafana/pkg/services/ngalert/notifier/merge"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/services/ngalert/remote/client"
	"github.com/grafana/grafana/pkg/util"
)

func TestGetTemplates(t *testing.T) {
	orgID := int64(1)
	revision := &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			Templates: generateTemplates(map[string]string{
				"template1": "test1",
				"template2": "test2",
				"template3": "test3",
			}, v1.TemplateKindGrafana),
			ExtraConfigs: []v1.ExtraConfiguration{
				{
					Identifier: "1234",
					TemplateFiles: map[string]string{
						"template1": "imported-test1",
						"template4": "imported-test4",
					},
				},
			},
		},
	}

	t.Run("returns templates from config file", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{
			"template1": models.ProvenanceAPI,
			"template2": models.ProvenanceFile,
		}, nil)

		result, err := sut.GetTemplates(context.Background(), orgID)
		require.NoError(t, err)

		expected := []v1.TemplateGroup{
			v1.NewTemplateGroup("",
				"template1",
				"test1",
				v1.TemplateKindGrafana,
				models.ProvenanceAPI,
			),
			v1.NewTemplateGroup("",
				"template2",
				"test2",
				v1.TemplateKindGrafana,
				models.ProvenanceFile,
			),
			v1.NewTemplateGroup("",
				"template3",
				"test3",
				v1.TemplateKindGrafana,
				models.ProvenanceNone,
			),
		}

		require.EqualValues(t, expected, result)

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&v1.TemplateGroup{}).ResourceType())
		prov.AssertExpectations(t)
	})

	t.Run("returns empty list when config file contains no templates", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{
				Config: &v1.AMConfigV1{},
			}, nil
		}

		result, err := sut.GetTemplates(context.Background(), 1)

		require.NoError(t, err)
		require.Empty(t, result)
		prov.AssertExpectations(t)
	})

	t.Run("returns imported templates if enabled", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		sut = sut.WithIncludeImported()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{
			"template1": models.ProvenanceAPI,
			"template2": models.ProvenanceFile,
		}, nil)

		result, err := sut.GetTemplates(context.Background(), orgID)
		require.NoError(t, err)

		// Compute the UIDs that MergeTemplates assigns for imported templates so the expected
		// values stay in sync with the production UID scheme without hardcoding hash strings.
		extraCfg := revision.Config.ExtraConfigs[0]
		importedMerged, _, _, err := notifymerge.MergeTemplates(revision.Config.Templates, extraCfg.TemplateFiles, extraCfg.Identifier)
		require.NoError(t, err)
		importedUID := func(name string) v1.ResourceUID {
			for uid, tmpl := range importedMerged {
				if tmpl.Kind == v1.TemplateKindMimir && tmpl.Title == name {
					return uid
				}
			}
			t.Fatalf("imported template %q not found in merged map", name)
			return ""
		}

		expected := []v1.TemplateGroup{
			v1.NewTemplateGroup("",
				"template1",
				"test1",
				v1.TemplateKindGrafana,
				models.ProvenanceAPI,
			),
			v1.NewTemplateGroup("",
				"template2",
				"test2",
				v1.TemplateKindGrafana,
				models.ProvenanceFile,
			),
			v1.NewTemplateGroup("",
				"template3",
				"test3",
				v1.TemplateKindGrafana,
				models.ProvenanceNone,
			),
			v1.NewTemplateGroup(importedUID("template1"),
				"template1",
				"imported-test1",
				v1.TemplateKindMimir,
				models.ProvenanceConvertedPrometheus,
			),
			v1.NewTemplateGroup(importedUID("template4"),
				"template4",
				"imported-test4",
				v1.TemplateKindMimir,
				models.ProvenanceConvertedPrometheus,
			),
		}

		require.EqualValues(t, expected, result)

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&v1.TemplateGroup{}).ResourceType())
		prov.AssertExpectations(t)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			_, err := sut.GetTemplates(context.Background(), 1)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when provenance status fails", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()

			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}

			expectedErr := errors.New("test")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, expectedErr)

			_, err := sut.GetTemplates(context.Background(), 1)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})
	})
}

func TestGetTemplate(t *testing.T) {
	orgID := int64(1)
	templateName := "template1"
	templateContent := "test1"
	importedTemplateName := "template2"
	importedTemplateContent := "imported"
	revision := &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			Templates: generateTemplates(map[string]string{
				templateName: templateContent,
			}, v1.TemplateKindGrafana),
			ExtraConfigs: []v1.ExtraConfiguration{
				{
					Identifier: "1234",
					TemplateFiles: map[string]string{
						importedTemplateName: importedTemplateContent,
					},
				},
			},
		},
	}

	t.Run("return a template from config by name", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		result, err := sut.GetTemplate(context.Background(), orgID, templateName)
		require.NoError(t, err)

		expected := v1.NewTemplateGroup("",
			templateName,
			templateContent,
			v1.TemplateKindGrafana,
			models.ProvenanceAPI,
		)

		require.Equal(t, expected, result)

		prov.AssertCalled(t, "GetProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
			return t.Title == expected.Title
		}), orgID)
		prov.AssertExpectations(t)
	})

	t.Run("imported templates cannot be retrieved by name", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		_, err := sut.GetTemplate(context.Background(), orgID, importedTemplateName)
		require.ErrorIs(t, err, ErrTemplateNotFound)
	})

	t.Run("return a template from config by UID", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

		result, err := sut.GetTemplate(context.Background(), orgID, string(v1.TemplateUID(v1.TemplateKindGrafana, templateName)))
		require.NoError(t, err)

		expected := v1.NewTemplateGroup("",
			templateName,
			templateContent,
			v1.TemplateKindGrafana,
			models.ProvenanceNone,
		)
		require.Equal(t, expected, result)
	})

	t.Run("return an imported template from config by UID", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}

		// Compute the UID that MergeTemplates assigns so the lookup matches production.
		extraCfg := revision.Config.ExtraConfigs[0]
		importedMerged, _, _, err := notifymerge.MergeTemplates(revision.Config.Templates, extraCfg.TemplateFiles, extraCfg.Identifier)
		require.NoError(t, err)
		var uid string
		for u, tmpl := range importedMerged {
			if tmpl.Kind == v1.TemplateKindMimir && tmpl.Title == importedTemplateName {
				uid = string(u)
				break
			}
		}
		require.NotEmpty(t, uid, "imported template UID should not be empty")

		t.Run("should be not found without flag enabled", func(t *testing.T) {
			_, err := sut.GetTemplate(context.Background(), orgID, uid)
			require.ErrorIs(t, err, ErrTemplateNotFound)
		})

		result, err := sut.WithIncludeImported().GetTemplate(context.Background(), orgID, uid)
		require.NoError(t, err)

		expected := v1.NewTemplateGroup(v1.ResourceUID(uid),
			importedTemplateName,
			importedTemplateContent,
			v1.TemplateKindMimir,
			models.ProvenanceConvertedPrometheus,
		)
		require.Equal(t, expected, result)
		prov.AssertExpectations(t)
	})

	t.Run("returns ErrTemplateNotFound when template does not exist", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		_, err := sut.GetTemplate(context.Background(), orgID, "not-found")
		require.ErrorIs(t, err, ErrTemplateNotFound)
		prov.AssertExpectations(t)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			_, err := sut.GetTemplate(context.Background(), 1, templateName)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when provenance status fails", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}
			expectedErr := errors.New("test")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, expectedErr)

			_, err := sut.GetTemplate(context.Background(), orgID, templateName)
			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})
	})
}

func TestUpsertTemplate(t *testing.T) {
	orgID := int64(1)
	templateName := "template1"
	currentTemplateContent := "test1"
	amConfigToken := util.GenerateShortUID()
	currentTemplate := v1.NewTemplateGroup("", templateName, currentTemplateContent, v1.TemplateKindGrafana, models.ProvenanceNone)
	revision := func() *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
			Config: &v1.AMConfigV1{
				Templates: map[v1.ResourceUID]v1.TemplateGroup{
					currentTemplate.UID: currentTemplate,
				},
			},
			ConcurrencyToken: amConfigToken,
		}
	}

	t.Run("adds new template to config file", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return &legacy_storage.ConfigRevision{
				Config:           &v1.AMConfigV1{},
				ConcurrencyToken: amConfigToken,
			}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
			assertInTransaction(t, ctx)
		}).Return(nil)

		tmpl := v1.TemplateGroup{
			Title:   "new-template",
			Content: "{{ define \"test\"}} test {{ end }}",
			ResourceMetadata: v1.ResourceMetadata{
				Provenance: models.ProvenanceAPI,
				Version:    "",
			},
			Kind: v1.TemplateKindGrafana,
		}

		result, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)

		require.NoError(t, err)
		require.Equal(t, v1.NewTemplateGroup("",
			tmpl.Title,
			tmpl.Content,
			tmpl.Kind,
			tmpl.Provenance,
		), result)

		require.Len(t, store.Calls, 2)

		require.Equal(t, "Save", store.Calls[1].Method)
		saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
		assert.Contains(t, saved.Config.Templates, result.UID)
		assert.Equal(t, result, saved.Config.Templates[result.UID])

		prov.AssertCalled(t, "SetProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
			return t.Title == tmpl.Title
		}), orgID, models.ProvenanceAPI)
	})

	t.Run("updates current template", func(t *testing.T) {
		t.Run("when version matches", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)
			prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
				assertInTransaction(t, ctx)
			}).Return(nil)

			tmpl := v1.TemplateGroup{
				Title:   templateName,
				Content: "{{ define \"test\"}} test {{ end }}",
				ResourceMetadata: v1.ResourceMetadata{
					Provenance: models.ProvenanceAPI,
					Version:    currentTemplate.Version,
				},
				Kind: v1.TemplateKindGrafana,
			}

			result, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)

			require.NoError(t, err)
			assert.Equal(t, v1.NewTemplateGroup("",
				tmpl.Title,
				tmpl.Content,
				tmpl.Kind,
				tmpl.Provenance,
			), result)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Save", store.Calls[1].Method)
			saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
			assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
			assert.Contains(t, saved.Config.Templates, result.UID)
			assert.Equal(t, result, saved.Config.Templates[result.UID])

			prov.AssertExpectations(t)
		})
		t.Run("bypasses optimistic concurrency validation when version is empty", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)
			prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
				assertInTransaction(t, ctx)
			}).Return(nil)

			tmpl := v1.TemplateGroup{
				Title:   templateName,
				Content: "{{ define \"test\"}} test {{ end }}",
				ResourceMetadata: v1.ResourceMetadata{
					Provenance: models.ProvenanceAPI,
					Version:    "",
				},
			}

			result, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)

			require.NoError(t, err)
			assert.Equal(t, v1.NewTemplateGroup("",
				tmpl.Title,
				tmpl.Content,
				v1.TemplateKindGrafana,
				tmpl.Provenance,
			), result)

			require.Equal(t, "Save", store.Calls[1].Method)
			saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
			assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
			assert.Contains(t, saved.Config.Templates, result.UID)
			assert.Equal(t, result, saved.Config.Templates[result.UID])
		})
	})

	t.Run("normalizes template content with no define", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
		prov.EXPECT().SaveSucceeds()

		tmpl := v1.TemplateGroup{
			Title:   templateName,
			Content: "content",
			ResourceMetadata: v1.ResourceMetadata{
				Provenance: models.ProvenanceNone,
				Version:    currentTemplate.Version,
			},
			Kind: v1.TemplateKindGrafana,
		}

		result, _ := sut.UpsertTemplate(context.Background(), orgID, tmpl)

		expectedContent := fmt.Sprintf("{{ define \"%s\" }}\n  content\n{{ end }}", templateName)
		require.Equal(t, v1.NewTemplateGroup("",
			tmpl.Title,
			expectedContent,
			tmpl.Kind,
			tmpl.Provenance,
		), result)
	})

	t.Run("does not reject template with unknown field", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
		prov.EXPECT().SaveSucceeds()

		tmpl := v1.TemplateGroup{
			Title:   "name",
			Content: "{{ .NotAField }}",
		}
		_, err := sut.UpsertTemplate(context.Background(), 1, tmpl)

		require.NoError(t, err)
	})

	t.Run("rejects templates that fail validation", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()

		t.Run("empty content", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "",
			}
			_, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		t.Run("invalid content", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "{{ .MyField }",
			}
			_, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		require.Empty(t, store.Calls)
		prov.AssertExpectations(t)
	})

	t.Run("rejects existing templates if provenance is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}

		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		expectedErr := errors.New("test")
		sut.validator = func(_ context.Context, from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		template := v1.TemplateGroup{
			Title:   "template1",
			Content: "asdf-new",
		}
		template.Provenance = models.ProvenanceNone

		_, err := sut.UpsertTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("rejects existing templates if version is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

		template := v1.TemplateGroup{
			Title:   "template1",
			Content: "asdf-new",
			ResourceMetadata: v1.ResourceMetadata{
				Version:    "bad-version",
				Provenance: models.ProvenanceNone,
			},
		}

		_, err := sut.UpsertTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, ErrVersionConflict)
		prov.AssertExpectations(t)
	})

	t.Run("rejects new template if version is set", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		template := v1.TemplateGroup{
			Title:   "template2",
			Content: "asdf-new",
			ResourceMetadata: v1.ResourceMetadata{
				Version:    "version",
				Provenance: models.ProvenanceNone,
			},
		}
		_, err := sut.UpsertTemplate(context.Background(), orgID, template)
		require.ErrorIs(t, err, ErrTemplateNotFound)
	})

	t.Run("rejects new template has UID ", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		template := v1.TemplateGroup{
			Title:   "template2",
			Content: "asdf-new",
			ResourceMetadata: v1.ResourceMetadata{
				UID:        "new-template",
				Provenance: models.ProvenanceNone,
			},
		}
		_, err := sut.UpsertTemplate(context.Background(), orgID, template)
		require.ErrorIs(t, err, ErrTemplateNotFound)
	})

	t.Run("rejects new templates of mimir kind", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		template := v1.TemplateGroup{
			Title:   "template2",
			Content: "asdf-new",
			ResourceMetadata: v1.ResourceMetadata{
				Provenance: models.ProvenanceNone,
			},
			Kind: v1.TemplateKindMimir,
		}
		_, err := sut.UpsertTemplate(context.Background(), orgID, template)
		require.ErrorIs(t, err, ErrTemplateInvalid)
	})

	t.Run("propagates errors", func(t *testing.T) {
		tmpl := v1.TemplateGroup{
			Title:   templateName,
			Content: "content",
			ResourceMetadata: v1.ResourceMetadata{
				Provenance: models.ProvenanceNone,
			},
		}
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			_, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when reading provenance status fails", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, expectedErr)

			_, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
			prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(expectedErr)

			_, err := sut.UpsertTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
				return expectedErr
			}
			prov.EXPECT().SaveSucceeds()
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

			_, err := sut.UpsertTemplate(context.Background(), 1, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func TestCreateTemplate(t *testing.T) {
	orgID := int64(1)
	amConfigToken := util.GenerateShortUID()

	tmpl := v1.TemplateGroup{
		Title:   "new-template",
		Content: "{{ define \"test\"}} test {{ end }}",
		ResourceMetadata: v1.ResourceMetadata{
			Provenance: models.ProvenanceAPI,
		},
		Kind: v1.TemplateKindGrafana,
	}

	revision := func() *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
			Config:           &v1.AMConfigV1{},
			ConcurrencyToken: amConfigToken,
		}
	}

	t.Run("adds new template to config file", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision(), nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
			assertInTransaction(t, ctx)
		}).Return(nil)

		result, err := sut.CreateTemplate(context.Background(), orgID, tmpl)

		require.NoError(t, err)
		require.Equal(t, v1.NewTemplateGroup("",
			tmpl.Title,
			tmpl.Content,
			tmpl.Kind,
			tmpl.Provenance,
		), result)

		require.Len(t, store.Calls, 2)

		require.Equal(t, "Save", store.Calls[1].Method)
		saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
		assert.Contains(t, saved.Config.Templates, result.UID)
		assert.Equal(t, result, saved.Config.Templates[result.UID])

		prov.AssertCalled(t, "SetProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
			return t.Title == tmpl.Title
		}), orgID, models.ProvenanceAPI)
	})

	t.Run("returns ErrTemplateExists if template exists", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return &legacy_storage.ConfigRevision{
				Config: &v1.AMConfigV1{
					Templates: map[v1.ResourceUID]v1.TemplateGroup{
						tmpl.UID: tmpl,
					},
				},
				ConcurrencyToken: amConfigToken,
			}, nil
		}

		_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)

		require.ErrorIs(t, err, ErrTemplateExists)
	})

	t.Run("rejects templates that fail validation", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()

		t.Run("empty content", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "",
			}
			_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		t.Run("invalid content", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "{{ .MyField }",
			}
			_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		t.Run("invalid kind", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "new-template",
				Content: "{{ define \"test\"}} test {{ end }}",
				Kind:    "unknown",
			}
			_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		require.Empty(t, store.Calls)
		prov.AssertExpectations(t)
	})

	t.Run("rejects templates with mimir kind", func(t *testing.T) {
		sut, _, _ := createTemplateServiceSut()

		tmpl := v1.TemplateGroup{
			Title:   "new-template",
			Content: "{{ define \"test\"}} test {{ end }}",
			Kind:    v1.TemplateKindMimir,
		}

		_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)
		require.ErrorIs(t, err, ErrTemplateInvalid)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(expectedErr)

			_, err := sut.CreateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
				return expectedErr
			}
			prov.EXPECT().SaveSucceeds()
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

			_, err := sut.CreateTemplate(context.Background(), 1, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func TestUpdateTemplate(t *testing.T) {
	orgID := int64(1)
	currentTemplateContent := "test1"

	tmpl := v1.TemplateGroup{
		Title:   "template1",
		Content: "{{ define \"test\"}} test {{ end }}",
		ResourceMetadata: v1.ResourceMetadata{
			Provenance: models.ProvenanceAPI,
			Version:    "",
		},
		Kind: v1.TemplateKindGrafana,
	}

	amConfigToken := util.GenerateShortUID()
	revision := func() *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
			Config: &v1.AMConfigV1{
				Templates: generateTemplates(map[string]string{
					tmpl.Title: currentTemplateContent,
				}, v1.TemplateKindGrafana),
			},
			ConcurrencyToken: amConfigToken,
		}
	}

	t.Run("returns ErrTemplateNotFound if template name does not exist", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return &legacy_storage.ConfigRevision{
				Config:           &v1.AMConfigV1{},
				ConcurrencyToken: amConfigToken,
			}, nil
		}
		_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

		require.ErrorIs(t, err, ErrTemplateNotFound)

		require.Len(t, store.Calls, 1)
		prov.AssertExpectations(t)
	})

	t.Run("returns ErrTemplateNotFound if template UID does not exist", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return &legacy_storage.ConfigRevision{
				Config: &v1.AMConfigV1{
					Templates: generateTemplates(map[string]string{
						"not-found": "test", // create a template with name that matches UID to make sure we do not search by name
						tmpl.Title:  "test",
					}, v1.TemplateKindGrafana),
				},
				ConcurrencyToken: amConfigToken,
			}, nil
		}
		tmpl := tmpl
		tmpl.UID = "not-found"
		_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

		require.ErrorIs(t, err, ErrTemplateNotFound)

		require.Len(t, store.Calls, 1)
		prov.AssertExpectations(t)
	})

	testcases := []struct {
		name        string
		templateUid v1.ResourceUID
	}{
		{
			name:        "by name",
			templateUid: "",
		},
		{
			name:        "by uid",
			templateUid: v1.TemplateUID(tmpl.Kind, tmpl.Title),
		},
	}

	for _, tt := range testcases {
		t.Run(fmt.Sprintf("updates current template %s", tt.name), func(t *testing.T) {
			t.Run("when version matches", func(t *testing.T) {
				sut, store, prov := createTemplateServiceSut()
				store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
					return revision(), nil
				}
				prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)
				prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
					assertInTransaction(t, ctx)
				}).Return(nil)

				tmpl.UID = tt.templateUid
				result, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

				require.NoError(t, err)
				assert.Equal(t, v1.NewTemplateGroup("",
					tmpl.Title,
					tmpl.Content,
					tmpl.Kind,
					tmpl.Provenance,
				), result)

				require.Len(t, store.Calls, 2)
				require.Equal(t, "Save", store.Calls[1].Method)
				saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
				assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
				assert.Contains(t, saved.Config.Templates, result.UID)
				assert.Equal(t, result, saved.Config.Templates[result.UID])

				prov.AssertExpectations(t)
			})
			t.Run("bypasses optimistic concurrency validation when version is empty", func(t *testing.T) {
				sut, store, prov := createTemplateServiceSut()
				store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
					return revision(), nil
				}
				prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)
				prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
					assertInTransaction(t, ctx)
				}).Return(nil)

				result, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

				require.NoError(t, err)
				assert.Equal(t, v1.NewTemplateGroup("",
					tmpl.Title,
					tmpl.Content,
					tmpl.Kind,
					tmpl.Provenance,
				), result)

				require.Equal(t, "Save", store.Calls[1].Method)
				saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
				assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
				assert.Contains(t, saved.Config.Templates, result.UID)
				assert.Equal(t, result, saved.Config.Templates[result.UID])
			})
		})
	}

	t.Run("creates a new template and delete old one when template is renamed", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Return(nil).Run(func(ctx context.Context, o models.Provisionable, org int64) {
			assertInTransaction(t, ctx)
		}).Return(nil)
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64, p models.Provenance) {
			assertInTransaction(t, ctx)
		}).Return(nil)

		oldName := tmpl.Title
		tmpl := tmpl
		tmpl.UID = v1.TemplateUID(tmpl.Kind, tmpl.Title) // UID matches the current template
		tmpl.Title = "new-template-name"                 // but name is different
		result, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

		require.NoError(t, err)
		assert.Equal(t, v1.NewTemplateGroup("",
			tmpl.Title,
			tmpl.Content,
			tmpl.Kind,
			tmpl.Provenance,
		), result)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Save", store.Calls[1].Method)
		saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
		assert.Contains(t, saved.Config.Templates, result.UID)
		assert.Equal(t, result, saved.Config.Templates[result.UID])
		assert.NotContains(t, saved.Config.Templates, v1.TemplateUID(tmpl.Kind, oldName))

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
			return t.Title == oldName
		}), mock.Anything)
		prov.AssertExpectations(t)
	})

	t.Run("rejects rename operation if template with the new name exists", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{
				Config: &v1.AMConfigV1{
					Templates: generateTemplates(map[string]string{
						tmpl.Title:          currentTemplateContent,
						"new-template-name": "test",
					}, v1.TemplateKindGrafana),
				},
				ConcurrencyToken: amConfigToken,
			}, nil
		}

		tmpl := tmpl
		tmpl.UID = v1.TemplateUID(tmpl.Kind, tmpl.Title) // UID matches the current template
		tmpl.Title = "new-template-name"                 // but name matches another existing template
		_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

		require.ErrorIs(t, err, ErrTemplateExists)

		prov.AssertExpectations(t)
	})

	t.Run("rejects templates that fail validation", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()

		t.Run("empty content", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "",
			}
			_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		t.Run("invalid content", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "{{ .MyField }",
			}
			_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		t.Run("invalid kind", func(t *testing.T) {
			tmpl := v1.TemplateGroup{
				Title:   "",
				Content: "",
				Kind:    "unknown",
			}
			_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		require.Empty(t, store.Calls)
		prov.AssertExpectations(t)
	})

	t.Run("rejects existing templates if provenance is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}

		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		expectedErr := errors.New("test")
		sut.validator = func(_ context.Context, from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		template := v1.TemplateGroup{
			Title:   "template1",
			Content: "asdf-new",
		}
		template.Provenance = models.ProvenanceNone

		_, err := sut.UpdateTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("rejects existing templates if version is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

		template := v1.TemplateGroup{
			Title:   "template1",
			Content: "asdf-new",
			ResourceMetadata: v1.ResourceMetadata{
				Version:    "bad-version",
				Provenance: models.ProvenanceNone,
			},
		}

		_, err := sut.UpdateTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, ErrVersionConflict)
		prov.AssertExpectations(t)
	})

	t.Run("rejects existing templates if kind changes", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

		template := v1.TemplateGroup{
			Title:   "template1",
			Content: "asdf-new",
			ResourceMetadata: v1.ResourceMetadata{
				UID:        v1.TemplateUID(v1.TemplateKindGrafana, "template1"),
				Version:    "bad-version",
				Provenance: models.ProvenanceNone,
			},
			Kind: v1.TemplateKindMimir,
		}

		_, err := sut.UpdateTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, ErrTemplateInvalid)
		prov.AssertExpectations(t)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when reading provenance status fails", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, expectedErr)

			_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
			prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(expectedErr)

			_, err := sut.UpdateTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
				return expectedErr
			}
			prov.EXPECT().SaveSucceeds()
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

			_, err := sut.UpdateTemplate(context.Background(), 1, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func TestDeleteTemplate(t *testing.T) {
	orgID := int64(1)
	templateName := "template1"
	templateContent := "test-1"
	tmplToDelete := v1.NewTemplateGroup("", templateName, templateContent, v1.TemplateKindGrafana, models.ProvenanceNone)
	templateVersion := tmplToDelete.Version
	amConfigToken := util.GenerateShortUID()
	revision := func() *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
			Config: &v1.AMConfigV1{
				Templates: map[v1.ResourceUID]v1.TemplateGroup{
					tmplToDelete.UID: tmplToDelete,
				},
			},
			ConcurrencyToken: amConfigToken,
		}
	}

	testCase := []struct {
		name              string
		templateNameOrUid string
	}{
		{
			name:              "by name",
			templateNameOrUid: templateName,
		},
		{
			name:              "by uid",
			templateNameOrUid: string(tmplToDelete.UID),
		},
	}
	for _, tt := range testCase {
		t.Run(fmt.Sprintf("deletes template from config file %s", tt.name), func(t *testing.T) {
			t.Run("when version matches", func(t *testing.T) {
				sut, store, prov := createTemplateServiceSut()
				store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
					return revision(), nil
				}
				prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceFile, nil)
				prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64) {
					assertInTransaction(t, ctx)
				}).Return(nil)

				err := sut.DeleteTemplate(context.Background(), orgID, tt.templateNameOrUid, models.ProvenanceFile, templateVersion)

				require.NoError(t, err)

				require.Len(t, store.Calls, 2)

				require.Equal(t, "Save", store.Calls[1].Method)
				saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
				assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
				assert.NotContains(t, saved.Config.Templates, tmplToDelete.UID)

				prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
					return t.Title == templateName
				}), orgID)

				prov.AssertExpectations(t)
			})

			t.Run("bypasses optimistic concurrency when version is empty", func(t *testing.T) {
				sut, store, prov := createTemplateServiceSut()
				store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
					return revision(), nil
				}
				prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceFile, nil)
				prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64) {
					assertInTransaction(t, ctx)
				}).Return(nil)

				err := sut.DeleteTemplate(context.Background(), orgID, tt.templateNameOrUid, models.ProvenanceFile, "")

				require.NoError(t, err)
				require.Len(t, store.Calls, 2)

				require.Equal(t, "Save", store.Calls[1].Method)
				saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
				assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
				assert.NotContains(t, saved.Config.Templates, tmplToDelete.UID)

				prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
					return t.Title == templateName
				}), orgID)

				prov.AssertExpectations(t)
			})
		})
	}

	t.Run("should look by name before uid", func(t *testing.T) {
		expectedToKeep := v1.NewTemplateGroup("", templateName, templateContent, v1.TemplateKindGrafana, models.ProvenanceNone)
		// This template has a name that is the UID of expectedToKeep.
		expectedToDelete := v1.NewTemplateGroup("", string(v1.TemplateUID(v1.TemplateKindGrafana, templateName)), templateContent, v1.TemplateKindGrafana, models.ProvenanceNone)
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{
				Config: &v1.AMConfigV1{
					Templates: map[v1.ResourceUID]v1.TemplateGroup{
						expectedToKeep.UID:   expectedToKeep,
						expectedToDelete.UID: expectedToDelete,
					},
				},
				ConcurrencyToken: amConfigToken,
			}, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceFile, nil)
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64) {
			assertInTransaction(t, ctx)
		}).Return(nil)

		err := sut.DeleteTemplate(context.Background(), orgID, expectedToDelete.Title, models.ProvenanceFile, templateVersion)

		require.NoError(t, err)

		require.Len(t, store.Calls, 2)

		require.Equal(t, "Save", store.Calls[1].Method)
		saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
		assert.NotContains(t, saved.Config.Templates, expectedToDelete.UID)
		assert.Contains(t, saved.Config.Templates, expectedToKeep.UID)

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(t *v1.TemplateGroup) bool {
			return t.Title == expectedToDelete.Title
		}), orgID)

		prov.AssertExpectations(t)
	})

	t.Run("does not error when deleting templates that do not exist", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}

		err := sut.DeleteTemplate(context.Background(), orgID, "not-found", models.ProvenanceNone, "")

		require.NoError(t, err)

		prov.AssertExpectations(t)
	})

	t.Run("errors if provenance is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		expectedErr := errors.New("test")
		sut.validator = func(_ context.Context, from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		err := sut.DeleteTemplate(context.Background(), 1, templateName, models.ProvenanceNone, "")

		require.ErrorIs(t, err, expectedErr)

		prov.AssertExpectations(t)
	})

	t.Run("errors if version is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		err := sut.DeleteTemplate(context.Background(), 1, templateName, models.ProvenanceNone, "bad-version")

		require.ErrorIs(t, err, ErrVersionConflict)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, models.ProvenanceNone, templateVersion)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when reading provenance status fails", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, expectedErr)

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, models.ProvenanceNone, templateVersion)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
			prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Return(expectedErr)

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, models.ProvenanceNone, templateVersion)

			require.ErrorIs(t, err, expectedErr)

			prov.AssertExpectations(t)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
				return expectedErr
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, models.ProvenanceNone, templateVersion)

			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func createTemplateServiceSut() (*TemplateService, *legacy_storage.AlertmanagerConfigStoreFake, *MockProvisioningStore) {
	store := &legacy_storage.AlertmanagerConfigStoreFake{}
	provStore := &MockProvisioningStore{}
	return &TemplateService{
		configStore:     store,
		provenanceStore: provStore,
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
		validator:       validation.ValidateProvenanceRelaxed,
		limitsProvider:  &NoopLimitsProvider{},
	}, store, provStore
}

func TestTemplateService_LimitsValidation(t *testing.T) {
	orgID := int64(1)
	amConfigToken := util.GenerateShortUID()

	newTmpl := v1.NewTemplateGroup("", "new-template", "{{ define \"test\"}} test {{ end }}", v1.TemplateKindGrafana, models.ProvenanceAPI)

	revision := func(existingCount int) *legacy_storage.ConfigRevision {
		templates := make(map[v1.ResourceUID]v1.TemplateGroup, existingCount)
		for i := 0; i < existingCount; i++ {
			tmpl := v1.NewTemplateGroup("", fmt.Sprintf("existing-%d", i), "content", v1.TemplateKindGrafana, models.ProvenanceNone)
			templates[tmpl.UID] = tmpl
		}
		return &legacy_storage.ConfigRevision{
			Config: &v1.AMConfigV1{
				Templates: templates,
			},
			ConcurrencyToken: amConfigToken,
		}
	}

	t.Run("CreateTemplate fails when template count limit exceeded", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		sut.limitsProvider = &mockLimitsProvider{
			limits: &client.TenantLimits{
				Templates: &client.TemplateLimits{
					MaxTemplatesCount:    5,
					MaxTemplateSizeBytes: 0, // unlimited
				},
			},
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(5), nil // Already at the limit
		}

		_, err := sut.CreateTemplate(context.Background(), orgID, newTmpl)

		require.ErrorIs(t, err, ErrTemplateLimitExceeded)
	})

	t.Run("CreateTemplate fails when template size limit exceeded", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		sut.limitsProvider = &mockLimitsProvider{
			limits: &client.TenantLimits{
				Templates: &client.TemplateLimits{
					MaxTemplatesCount:    0, // unlimited
					MaxTemplateSizeBytes: 10,
				},
			},
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(0), nil
		}

		largeTmpl := newTmpl
		largeTmpl.Content = "{{ define \"test\"}} this is a very long template content {{ end }}"

		_, err := sut.CreateTemplate(context.Background(), orgID, largeTmpl)

		require.ErrorIs(t, err, ErrTemplateSizeExceeded)
	})

	t.Run("CreateTemplate succeeds when under limits", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		sut.limitsProvider = &mockLimitsProvider{
			limits: &client.TenantLimits{
				Templates: &client.TemplateLimits{
					MaxTemplatesCount:    10,
					MaxTemplateSizeBytes: 1000,
				},
			},
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(5), nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

		_, err := sut.CreateTemplate(context.Background(), orgID, newTmpl)

		require.NoError(t, err)
	})

	t.Run("CreateTemplate succeeds when limits are nil", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		sut.limitsProvider = &mockLimitsProvider{
			limits: nil,
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(100), nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

		_, err := sut.CreateTemplate(context.Background(), orgID, newTmpl)

		require.NoError(t, err)
	})

	t.Run("CreateTemplate succeeds when limits are zero (unlimited)", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		sut.limitsProvider = &mockLimitsProvider{
			limits: &client.TenantLimits{
				Templates: &client.TemplateLimits{
					MaxTemplatesCount:    0, // unlimited
					MaxTemplateSizeBytes: 0, // unlimited
				},
			},
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(100), nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

		_, err := sut.CreateTemplate(context.Background(), orgID, newTmpl)

		require.NoError(t, err)
	})

	t.Run("CreateTemplate succeeds when limits provider returns error (fail open)", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		sut.limitsProvider = &mockLimitsProvider{
			err: errors.New("failed to fetch limits"),
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(100), nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

		_, err := sut.CreateTemplate(context.Background(), orgID, newTmpl)

		require.NoError(t, err)
	})

	t.Run("UpdateTemplate fails when template size limit exceeded", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		existingTemplateName := "existing-template"
		sut.limitsProvider = &mockLimitsProvider{
			limits: &client.TenantLimits{
				Templates: &client.TemplateLimits{
					MaxTemplatesCount:    100, // Should not matter for updates
					MaxTemplateSizeBytes: 10,
				},
			},
		}
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{
				Config: &v1.AMConfigV1{
					Templates: generateTemplates(map[string]string{
						existingTemplateName: "short",
					}, v1.TemplateKindGrafana),
				},
				ConcurrencyToken: amConfigToken,
			}, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

		largeTmpl := v1.TemplateGroup{
			Title:   existingTemplateName,
			Content: "{{ define \"test\"}} this is a very long template content that exceeds the limit {{ end }}",
		}

		_, err := sut.UpdateTemplate(context.Background(), orgID, largeTmpl)

		require.ErrorIs(t, err, ErrTemplateSizeExceeded)
	})

	t.Run("UpdateTemplate does not check count limit", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		existingTemplateName := "existing-1"
		sut.limitsProvider = &mockLimitsProvider{
			limits: &client.TenantLimits{
				Templates: &client.TemplateLimits{
					MaxTemplatesCount:    1, // Way under current count
					MaxTemplateSizeBytes: 10000,
				},
			},
		}
		// Create a revision with many templates (over the count limit)
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(99), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil)

		updateTmpl := v1.TemplateGroup{
			Title:   existingTemplateName,
			Content: "{{ define \"test\"}} updated content {{ end }}",
		}

		// Update should succeed because count limit doesn't apply to updates
		_, err := sut.UpdateTemplate(context.Background(), orgID, updateTmpl)

		require.NoError(t, err)
	})
}

// mockLimitsProvider is a test implementation of LimitsProvider
type mockLimitsProvider struct {
	limits *client.TenantLimits
	err    error
}

func (m *mockLimitsProvider) GetLimits(_ context.Context) (*client.TenantLimits, error) {
	return m.limits, m.err
}

func generateTemplates(templates map[string]string, kind v1.TemplateKind) map[v1.ResourceUID]v1.TemplateGroup {
	templatesUIDs := make(map[v1.ResourceUID]v1.TemplateGroup, len(templates))
	for name, content := range templates {
		tmpl := v1.NewTemplateGroup("", name, content, kind, models.ProvenanceNone)
		templatesUIDs[tmpl.UID] = tmpl
	}
	return templatesUIDs
}
