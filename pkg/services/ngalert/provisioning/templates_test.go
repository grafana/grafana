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
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning/validation"
	"github.com/grafana/grafana/pkg/util"
)

func TestGetTemplates(t *testing.T) {
	orgID := int64(1)
	revision := &legacy_storage.ConfigRevision{
		Config: &definitions.PostableUserConfig{
			TemplateFiles: map[string]string{
				"template1": "test1",
				"template2": "test2",
				"template3": "test3",
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

		expected := []definitions.NotificationTemplate{
			{
				Name:            "template1",
				Template:        "test1",
				Provenance:      definitions.Provenance(models.ProvenanceAPI),
				ResourceVersion: calculateTemplateFingerprint("test1"),
			},
			{
				Name:            "template2",
				Template:        "test2",
				Provenance:      definitions.Provenance(models.ProvenanceFile),
				ResourceVersion: calculateTemplateFingerprint("test2"),
			},
			{
				Name:            "template3",
				Template:        "test3",
				Provenance:      definitions.Provenance(models.ProvenanceNone),
				ResourceVersion: calculateTemplateFingerprint("test3"),
			},
		}

		require.ElementsMatch(t, expected, result)

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&definitions.NotificationTemplate{}).ResourceType())
		prov.AssertExpectations(t)
	})

	t.Run("returns empty list when config file contains no templates", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{
				Config: &definitions.PostableUserConfig{},
			}, nil
		}

		result, err := sut.GetTemplates(context.Background(), 1)

		require.NoError(t, err)
		require.Empty(t, result)
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
	revision := &legacy_storage.ConfigRevision{
		Config: &definitions.PostableUserConfig{
			TemplateFiles: map[string]string{
				templateName: templateContent,
			},
		},
	}

	t.Run("return a template from config file by name", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		result, err := sut.GetTemplate(context.Background(), orgID, templateName)
		require.NoError(t, err)

		expected := definitions.NotificationTemplate{
			Name:            templateName,
			Template:        templateContent,
			Provenance:      definitions.Provenance(models.ProvenanceAPI),
			ResourceVersion: calculateTemplateFingerprint(templateContent),
		}

		require.Equal(t, expected, result)

		prov.AssertCalled(t, "GetProvenance", mock.Anything, mock.MatchedBy(func(t *definitions.NotificationTemplate) bool {
			return t.Name == expected.Name
		}), orgID)
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

func TestSetTemplate(t *testing.T) {
	orgID := int64(1)
	templateName := "template1"
	currentTemplateContent := "test1"
	amConfigToken := util.GenerateShortUID()
	revision := func() *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
			Config: &definitions.PostableUserConfig{
				TemplateFiles: map[string]string{
					templateName: currentTemplateContent,
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
				Config:           &definitions.PostableUserConfig{},
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

		tmpl := definitions.NotificationTemplate{
			Name:            "new-template",
			Template:        "{{ define \"test\"}} test {{ end }}",
			Provenance:      definitions.Provenance(models.ProvenanceAPI),
			ResourceVersion: "",
		}

		result, err := sut.SetTemplate(context.Background(), orgID, tmpl)

		require.NoError(t, err)
		require.Equal(t, definitions.NotificationTemplate{
			Name:            tmpl.Name,
			Template:        tmpl.Template,
			Provenance:      tmpl.Provenance,
			ResourceVersion: calculateTemplateFingerprint(tmpl.Template),
		}, result)

		require.Len(t, store.Calls, 2)

		require.Equal(t, "Save", store.Calls[1].Method)
		saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
		assert.Contains(t, saved.Config.TemplateFiles, tmpl.Name)
		assert.Equal(t, tmpl.Template, saved.Config.TemplateFiles[tmpl.Name])

		prov.AssertCalled(t, "SetProvenance", mock.Anything, mock.MatchedBy(func(t *definitions.NotificationTemplate) bool {
			return t.Name == tmpl.Name
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

			tmpl := definitions.NotificationTemplate{
				Name:            templateName,
				Template:        "{{ define \"test\"}} test {{ end }}",
				Provenance:      definitions.Provenance(models.ProvenanceAPI),
				ResourceVersion: calculateTemplateFingerprint("test1"),
			}

			result, err := sut.SetTemplate(context.Background(), orgID, tmpl)

			require.NoError(t, err)
			assert.Equal(t, definitions.NotificationTemplate{
				Name:            tmpl.Name,
				Template:        tmpl.Template,
				Provenance:      tmpl.Provenance,
				ResourceVersion: calculateTemplateFingerprint(tmpl.Template),
			}, result)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Save", store.Calls[1].Method)
			saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
			assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
			assert.Contains(t, saved.Config.TemplateFiles, tmpl.Name)
			assert.Equal(t, tmpl.Template, saved.Config.TemplateFiles[tmpl.Name])

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

			tmpl := definitions.NotificationTemplate{
				Name:            templateName,
				Template:        "{{ define \"test\"}} test {{ end }}",
				Provenance:      definitions.Provenance(models.ProvenanceAPI),
				ResourceVersion: "",
			}

			result, err := sut.SetTemplate(context.Background(), orgID, tmpl)

			require.NoError(t, err)
			assert.Equal(t, definitions.NotificationTemplate{
				Name:            tmpl.Name,
				Template:        tmpl.Template,
				Provenance:      tmpl.Provenance,
				ResourceVersion: calculateTemplateFingerprint(tmpl.Template),
			}, result)

			require.Equal(t, "Save", store.Calls[1].Method)
			saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
			assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
			assert.Contains(t, saved.Config.TemplateFiles, tmpl.Name)
			assert.Equal(t, tmpl.Template, saved.Config.TemplateFiles[tmpl.Name])
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

		tmpl := definitions.NotificationTemplate{
			Name:            templateName,
			Template:        "content",
			Provenance:      definitions.Provenance(models.ProvenanceNone),
			ResourceVersion: calculateTemplateFingerprint(currentTemplateContent),
		}

		result, _ := sut.SetTemplate(context.Background(), orgID, tmpl)

		expectedContent := fmt.Sprintf("{{ define \"%s\" }}\n  content\n{{ end }}", templateName)
		require.Equal(t, definitions.NotificationTemplate{
			Name:            tmpl.Name,
			Template:        expectedContent,
			Provenance:      tmpl.Provenance,
			ResourceVersion: calculateTemplateFingerprint(expectedContent),
		}, result)
	})

	t.Run("does not reject template with unknown field", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			assert.Equal(t, orgID, org)
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)
		prov.EXPECT().SaveSucceeds()

		tmpl := definitions.NotificationTemplate{
			Name:     "name",
			Template: "{{ .NotAField }}",
		}
		_, err := sut.SetTemplate(context.Background(), 1, tmpl)

		require.NoError(t, err)
	})

	t.Run("rejects templates that fail validation", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()

		t.Run("empty content", func(t *testing.T) {
			tmpl := definitions.NotificationTemplate{
				Name:     "",
				Template: "",
			}
			_, err := sut.SetTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, ErrTemplateInvalid)
		})

		t.Run("invalid content", func(t *testing.T) {
			tmpl := definitions.NotificationTemplate{
				Name:     "",
				Template: "{{ .MyField }",
			}
			_, err := sut.SetTemplate(context.Background(), orgID, tmpl)
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
		sut.validator = func(from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		template := definitions.NotificationTemplate{
			Name:     "template1",
			Template: "asdf-new",
		}
		template.Provenance = definitions.Provenance(models.ProvenanceNone)

		_, err := sut.SetTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("rejects existing templates if version is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, nil)

		template := definitions.NotificationTemplate{
			Name:            "template1",
			Template:        "asdf-new",
			ResourceVersion: "bad-version",
			Provenance:      definitions.Provenance(models.ProvenanceNone),
		}

		_, err := sut.SetTemplate(context.Background(), orgID, template)

		require.ErrorIs(t, err, ErrVersionConflict)
		prov.AssertExpectations(t)
	})

	t.Run("rejects new template if version is set", func(t *testing.T) {
		sut, store, _ := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		template := definitions.NotificationTemplate{
			Name:            "template2",
			Template:        "asdf-new",
			ResourceVersion: "version",
			Provenance:      definitions.Provenance(models.ProvenanceNone),
		}
		_, err := sut.SetTemplate(context.Background(), orgID, template)
		require.ErrorIs(t, err, ErrTemplateNotFound)
	})
	t.Run("propagates errors", func(t *testing.T) {
		tmpl := definitions.NotificationTemplate{
			Name:       templateName,
			Template:   "content",
			Provenance: definitions.Provenance(models.ProvenanceNone),
		}
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			_, err := sut.SetTemplate(context.Background(), orgID, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when reading provenance status fails", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, org int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			expectedErr := errors.New("test")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceNone, expectedErr)

			_, err := sut.SetTemplate(context.Background(), orgID, tmpl)

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

			_, err := sut.SetTemplate(context.Background(), orgID, tmpl)
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

			_, err := sut.SetTemplate(context.Background(), 1, tmpl)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func TestDeleteTemplate(t *testing.T) {
	orgID := int64(1)
	templateName := "template1"
	templateContent := "test-1"
	templateVersion := calculateTemplateFingerprint(templateContent)
	amConfigToken := util.GenerateShortUID()
	revision := func() *legacy_storage.ConfigRevision {
		return &legacy_storage.ConfigRevision{
			Config: &definitions.PostableUserConfig{
				TemplateFiles: map[string]string{
					templateName: templateContent,
				},
			},
			ConcurrencyToken: amConfigToken,
		}
	}

	t.Run("deletes template from config file on success", func(t *testing.T) {
		t.Run("when version matches", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision(), nil
			}
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceFile, nil)
			prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Run(func(ctx context.Context, o models.Provisionable, org int64) {
				assertInTransaction(t, ctx)
			}).Return(nil)

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, definitions.Provenance(models.ProvenanceFile), templateVersion)

			require.NoError(t, err)

			require.Len(t, store.Calls, 2)

			require.Equal(t, "Save", store.Calls[1].Method)
			saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
			assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
			assert.NotContains(t, saved.Config.TemplateFiles, templateName)

			prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(t *definitions.NotificationTemplate) bool {
				return t.Name == templateName
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

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, definitions.Provenance(models.ProvenanceFile), "")

			require.NoError(t, err)
			require.Len(t, store.Calls, 2)

			require.Equal(t, "Save", store.Calls[1].Method)
			saved := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
			assert.Equal(t, amConfigToken, saved.ConcurrencyToken)
			assert.NotContains(t, saved.Config.TemplateFiles, templateName)

			prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(t *definitions.NotificationTemplate) bool {
				return t.Name == templateName
			}), orgID)

			prov.AssertExpectations(t)
		})
	})

	t.Run("does not error when deleting templates that do not exist", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}

		err := sut.DeleteTemplate(context.Background(), orgID, "not-found", definitions.Provenance(models.ProvenanceNone), "")

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
		sut.validator = func(from, to models.Provenance) error {
			assert.Equal(t, models.ProvenanceAPI, from)
			assert.Equal(t, models.ProvenanceNone, to)
			return expectedErr
		}

		err := sut.DeleteTemplate(context.Background(), 1, templateName, definitions.Provenance(models.ProvenanceNone), "")

		require.ErrorIs(t, err, expectedErr)

		prov.AssertExpectations(t)
	})

	t.Run("errors if version is not right", func(t *testing.T) {
		sut, store, prov := createTemplateServiceSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision(), nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		err := sut.DeleteTemplate(context.Background(), 1, templateName, definitions.Provenance(models.ProvenanceNone), "bad-version")

		require.ErrorIs(t, err, ErrVersionConflict)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, prov := createTemplateServiceSut()
			expectedErr := errors.New("test")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, definitions.Provenance(models.ProvenanceNone), templateVersion)

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

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, definitions.Provenance(models.ProvenanceNone), templateVersion)

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

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, definitions.Provenance(models.ProvenanceNone), templateVersion)

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

			err := sut.DeleteTemplate(context.Background(), orgID, templateName, definitions.Provenance(models.ProvenanceNone), templateVersion)

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
	}, store, provStore
}
