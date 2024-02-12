package provisioning

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"testing"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestGetMuteTimings(t *testing.T) {
	orgID := int64(1)
	revision := &cfgRevision{
		cfg: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					MuteTimeIntervals: []config.MuteTimeInterval{
						{
							Name:          "Test1",
							TimeIntervals: nil,
						},
						{
							Name:          "Test2",
							TimeIntervals: nil,
						},
						{
							Name:          "Test3",
							TimeIntervals: nil,
						},
					},
				},
			},
		},
	}

	provenances := map[string]models.Provenance{
		"Test1": models.ProvenanceFile,
		"Test2": models.ProvenanceAPI,
	}

	t.Run("service returns timings from config file", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return revision, nil
		}

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(provenances, nil)

		result, err := sut.GetMuteTimings(context.Background(), 1)

		require.NoError(t, err)
		require.Len(t, result, len(revision.cfg.AlertmanagerConfig.MuteTimeIntervals))
		require.Equal(t, "Test1", result[0].Name)
		require.EqualValues(t, provenances["Test1"], result[0].Provenance)
		require.Equal(t, "Test2", result[1].Name)
		require.EqualValues(t, provenances["Test2"], result[1].Provenance)
		require.Equal(t, "Test3", result[2].Name)
		require.EqualValues(t, "", result[2].Provenance)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&definitions.MuteTimeInterval{}).ResourceType())
	})

	t.Run("service returns empty list when config file contains no mute timings", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: &definitions.PostableUserConfig{}}, nil
		}

		result, err := sut.GetMuteTimings(context.Background(), 1)

		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expected := fmt.Errorf("failed")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expected
			}

			_, err := sut.GetMuteTimings(context.Background(), orgID)

			require.ErrorIs(t, err, expected)
		})

		t.Run("when unable to read provenance", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return revision, nil
			}
			expected := fmt.Errorf("failed")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, expected)

			_, err := sut.GetMuteTimings(context.Background(), orgID)

			require.ErrorIs(t, err, expected)
		})
	})
}

func TestGetMuteTiming(t *testing.T) {
	orgID := int64(1)
	revision := &cfgRevision{
		cfg: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					MuteTimeIntervals: []config.MuteTimeInterval{
						{
							Name:          "Test1",
							TimeIntervals: nil,
						},
					},
				},
			},
		},
	}

	t.Run("service returns timing by name", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return revision, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		result, err := sut.GetMuteTiming(context.Background(), "Test1", orgID)

		require.NoError(t, err)

		require.Equal(t, "Test1", result.Name)
		require.EqualValues(t, models.ProvenanceAPI, result.Provenance)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		prov.AssertCalled(t, "GetProvenance", mock.Anything, &result, orgID)
	})

	t.Run("service returns ErrTimeIntervalNotFound if no mute timings", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: &definitions.PostableUserConfig{}}, nil
		}

		_, err := sut.GetMuteTiming(context.Background(), "Test1", orgID)

		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("service returns ErrTimeIntervalNotFound if no mute timing by name", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return revision, nil
		}

		_, err := sut.GetMuteTiming(context.Background(), "Test123", orgID)

		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expected := fmt.Errorf("failed")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expected
			}

			_, err := sut.GetMuteTiming(context.Background(), "Test1", orgID)

			require.ErrorIs(t, err, expected)
		})

		t.Run("when unable to read provenance", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return revision, nil
			}
			expected := fmt.Errorf("failed")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return("", expected)

			_, err := sut.GetMuteTiming(context.Background(), "Test1", orgID)

			require.ErrorIs(t, err, expected)
		})
	})
}

func TestCreateMuteTimings(t *testing.T) {
	orgID := int64(1)

	initialConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			TemplateFiles: nil,
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					MuteTimeIntervals: []config.MuteTimeInterval{
						{
							Name: "TEST",
						},
					},
				},
				Receivers: nil,
			},
		}
	}

	expected := config.MuteTimeInterval{
		Name: "Test",
		TimeIntervals: []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 10, EndMinute: 60,
					},
				},
			},
		},
	}
	expectedProvenance := models.ProvenanceAPI
	timing := definitions.MuteTimeInterval{
		MuteTimeInterval: expected,
		Provenance:       definitions.Provenance(expectedProvenance),
	}

	t.Run("returns ErrTimeIntervalInvalid if mute timings fail validation", func(t *testing.T) {
		sut, _, _ := createMuteTimingSvcSut()
		timing := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "",
			},
			Provenance: definitions.Provenance(models.ProvenanceFile),
		}

		_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalInvalid.Base.Is(err), "expected ErrTimeIntervalInvalid but got %s", err)
	})

	t.Run("returns ErrTimeIntervalExists if mute timing with the name exists", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}

		existing := initialConfig().AlertmanagerConfig.MuteTimeIntervals[0]
		timing := definitions.MuteTimeInterval{
			MuteTimeInterval: existing,
			Provenance:       definitions.Provenance(models.ProvenanceFile),
		}

		_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalExists.Is(err), "expected ErrTimeIntervalExists but got %s", err)
	})

	t.Run("saves mute timing and provenance in a transaction", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64, _ models.Provenance) error {
				assertInTransaction(t, ctx)
				return nil
			})

		result, err := sut.CreateMuteTiming(context.Background(), timing, orgID)
		require.NoError(t, err)

		require.EqualValues(t, expected, result.MuteTimeInterval)
		require.EqualValues(t, expectedProvenance, result.Provenance)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		expectedTimings := append(initialConfig().AlertmanagerConfig.MuteTimeIntervals, expected)
		require.EqualValues(t, expectedTimings, revision.cfg.AlertmanagerConfig.MuteTimeIntervals)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, &timing, orgID, expectedProvenance)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expectedErr
			}
			_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
				return expectedErr
			}

			_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func TestUpdateMuteTimings(t *testing.T) {
	orgID := int64(1)

	initialConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			TemplateFiles: nil,
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					MuteTimeIntervals: []config.MuteTimeInterval{
						{
							Name: "Test",
						},
					},
				},
				Receivers: nil,
			},
		}
	}

	expected := config.MuteTimeInterval{
		Name: "Test",
		TimeIntervals: []timeinterval.TimeInterval{
			{
				Times: []timeinterval.TimeRange{
					{
						StartMinute: 10, EndMinute: 60,
					},
				},
			},
		},
	}
	expectedProvenance := models.ProvenanceAPI
	timing := definitions.MuteTimeInterval{
		MuteTimeInterval: expected,
		Provenance:       definitions.Provenance(expectedProvenance),
	}

	t.Run("rejects mute timings that fail validation", func(t *testing.T) {
		sut, _, _ := createMuteTimingSvcSut()
		timing := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "",
			},
			Provenance: definitions.Provenance(models.ProvenanceFile),
		}

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalInvalid.Base.Is(err), "expected ErrTimeIntervalInvalid but got %s", err)
	})

	t.Run("returns ErrMuteTimingsNotFound if mute timing does not exist", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}

		timing := definitions.MuteTimeInterval{
			MuteTimeInterval: config.MuteTimeInterval{
				Name: "No-timing",
			},
			Provenance: definitions.Provenance(models.ProvenanceFile),
		}

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("saves mute timing and provenance in a transaction", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64, _ models.Provenance) error {
				assertInTransaction(t, ctx)
				return nil
			})

		result, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.NoError(t, err)

		require.EqualValues(t, expected, result.MuteTimeInterval)
		require.EqualValues(t, expectedProvenance, result.Provenance)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		require.EqualValues(t, []config.MuteTimeInterval{expected}, revision.cfg.AlertmanagerConfig.MuteTimeIntervals)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, &timing, orgID, expectedProvenance)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expectedErr
			}
			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
				return expectedErr
			}

			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func TestDeleteMuteTimings(t *testing.T) {
	orgID := int64(1)

	timingToDelete := config.MuteTimeInterval{Name: "unused-timing"}
	usedTiming := "used-timing"
	initialConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			TemplateFiles: nil,
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						MuteTimeIntervals: []string{usedTiming},
					},
					MuteTimeIntervals: []config.MuteTimeInterval{
						{
							Name: usedTiming,
						},
						timingToDelete,
					},
				},
				Receivers: nil,
			},
		}
	}

	t.Run("re-saves config and deletes provenance if mute timing does not exist", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		err := sut.DeleteMuteTiming(context.Background(), "no-timing", orgID)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		require.EqualValues(t, initialConfig().AlertmanagerConfig.MuteTimeIntervals, revision.cfg.AlertmanagerConfig.MuteTimeIntervals)

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, &definitions.MuteTimeInterval{MuteTimeInterval: config.MuteTimeInterval{Name: "no-timing"}}, orgID)
	})

	t.Run("returns ErrTimeIntervalInUse if mute timing is used", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}

		err := sut.DeleteMuteTiming(context.Background(), usedTiming, orgID)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.Truef(t, ErrTimeIntervalInUse.Is(err), "expected ErrTimeIntervalInUse but got %s", err)
	})

	t.Run("deletes mute timing and provenance in transaction", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64) error {
				assertInTransaction(t, ctx)
				return nil
			})

		err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Name, orgID)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		expectedMuteTimings := slices.DeleteFunc(initialConfig().AlertmanagerConfig.MuteTimeIntervals, func(interval config.MuteTimeInterval) bool {
			return interval.Name == timingToDelete.Name
		})
		require.EqualValues(t, expectedMuteTimings, revision.cfg.AlertmanagerConfig.MuteTimeIntervals)

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, &definitions.MuteTimeInterval{MuteTimeInterval: timingToDelete}, orgID)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expectedErr
			}
			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Name, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Name, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
				return expectedErr
			}

			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Name, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func createMuteTimingSvcSut() (*MuteTimingService, *alertmanagerConfigStoreFake, *MockProvisioningStore) {
	store := &alertmanagerConfigStoreFake{}
	prov := &MockProvisioningStore{}
	return &MuteTimingService{
		configStore:     store,
		provenanceStore: prov,
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
	}, store, prov
}
