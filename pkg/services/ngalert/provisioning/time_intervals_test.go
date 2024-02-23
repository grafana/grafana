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

func TestGetTimeIntervals(t *testing.T) {
	orgID := int64(1)
	revision := &cfgRevision{
		cfg: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					TimeIntervals: []config.TimeInterval{
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

	t.Run("service returns time intervals from config file", func(t *testing.T) {
		sut, store, prov := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return revision, nil
		}

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(provenances, nil)

		result, err := sut.GetTimeIntervals(context.Background(), 1)

		require.NoError(t, err)
		require.Len(t, result, len(revision.cfg.AlertmanagerConfig.TimeIntervals))
		require.Equal(t, "Test1", result[0].Name)
		require.EqualValues(t, provenances["Test1"], result[0].Provenance)
		require.Equal(t, "Test2", result[1].Name)
		require.EqualValues(t, provenances["Test2"], result[1].Provenance)
		require.Equal(t, "Test3", result[2].Name)
		require.EqualValues(t, "", result[2].Provenance)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&definitions.TimeInterval{}).ResourceType())
	})

	t.Run("service returns empty list when config file contains no time intervals", func(t *testing.T) {
		sut, store, _ := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: &definitions.PostableUserConfig{}}, nil
		}
		result, err := sut.GetTimeIntervals(context.Background(), 1)
		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			expected := fmt.Errorf("failed")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expected
			}
			_, err := sut.GetTimeIntervals(context.Background(), orgID)
			require.ErrorIs(t, err, expected)
		})

		t.Run("when unable to read provenance", func(t *testing.T) {
			sut, store, prov := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return revision, nil
			}
			expected := fmt.Errorf("failed")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, expected)
			_, err := sut.GetTimeIntervals(context.Background(), orgID)
			require.ErrorIs(t, err, expected)
		})
	})
}

func TestGetTimeInterval(t *testing.T) {
	orgID := int64(1)
	revision := &cfgRevision{
		cfg: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					TimeIntervals: []config.TimeInterval{
						{
							Name:          "Test1",
							TimeIntervals: nil,
						},
					},
				},
			},
		},
	}

	t.Run("service returns time interval by name", func(t *testing.T) {
		sut, store, prov := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return revision, nil
		}
		prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return(models.ProvenanceAPI, nil)

		result, err := sut.GetTimeInterval(context.Background(), "Test1", orgID)

		require.NoError(t, err)

		require.Equal(t, "Test1", result.Name)
		require.EqualValues(t, models.ProvenanceAPI, result.Provenance)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		prov.AssertCalled(t, "GetProvenance", mock.Anything, &result, orgID)
	})

	t.Run("service returns ErrTimeIntervalNotFound if no time interval", func(t *testing.T) {
		sut, store, _ := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: &definitions.PostableUserConfig{}}, nil
		}
		_, err := sut.GetTimeInterval(context.Background(), "Test1", orgID)
		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("service returns ErrTimeIntervalNotFound if no time interval by name", func(t *testing.T) {
		sut, store, _ := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return revision, nil
		}
		_, err := sut.GetTimeInterval(context.Background(), "Test123", orgID)
		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			expected := fmt.Errorf("failed")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expected
			}
			_, err := sut.GetTimeInterval(context.Background(), "Test1", orgID)
			require.ErrorIs(t, err, expected)
		})

		t.Run("when unable to read provenance", func(t *testing.T) {
			sut, store, prov := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return revision, nil
			}
			expected := fmt.Errorf("failed")
			prov.EXPECT().GetProvenance(mock.Anything, mock.Anything, mock.Anything).Return("", expected)
			_, err := sut.GetTimeInterval(context.Background(), "Test1", orgID)
			require.ErrorIs(t, err, expected)
		})
	})
}

func TestCreateTimeIntervals(t *testing.T) {
	orgID := int64(1)

	initialConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			TemplateFiles: nil,
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					TimeIntervals: []config.TimeInterval{
						{
							Name: "TEST",
						},
					},
				},
				Receivers: nil,
			},
		}
	}

	expected := config.TimeInterval{
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
	ti := definitions.TimeInterval{
		TimeInterval: expected,
		Provenance:   definitions.Provenance(expectedProvenance),
	}

	t.Run("returns ErrTimeIntervalInvalid if time interval fail validation", func(t *testing.T) {
		sut, _, _ := createTimeIntervalSvcSut()
		ti := definitions.TimeInterval{
			TimeInterval: config.TimeInterval{
				Name: "",
			},
			Provenance: definitions.Provenance(models.ProvenanceFile),
		}
		_, err := sut.CreateTimeInterval(context.Background(), ti, orgID)
		require.Truef(t, ErrTimeIntervalInvalid.Base.Is(err), "expected ErrTimeIntervalInvalid but got %s", err)
	})

	t.Run("returns ErrTimeIntervalExists if time interval with the name exists", func(t *testing.T) {
		sut, store, _ := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}
		existing := initialConfig().AlertmanagerConfig.TimeIntervals[0]
		ti := definitions.TimeInterval{
			TimeInterval: existing,
			Provenance:   definitions.Provenance(models.ProvenanceFile),
		}
		_, err := sut.CreateTimeInterval(context.Background(), ti, orgID)
		require.Truef(t, ErrTimeIntervalExists.Is(err), "expected ErrTimeIntervalExists but got %s", err)
	})

	t.Run("saves time interval and provenance in a transaction", func(t *testing.T) {
		sut, store, prov := createTimeIntervalSvcSut()
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

		result, err := sut.CreateTimeInterval(context.Background(), ti, orgID)
		require.NoError(t, err)

		require.EqualValues(t, expected, result.TimeInterval)
		require.EqualValues(t, expectedProvenance, result.Provenance)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		expectedTimings := append(initialConfig().AlertmanagerConfig.TimeIntervals, expected)
		require.EqualValues(t, expectedTimings, revision.cfg.AlertmanagerConfig.TimeIntervals)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, &ti, orgID, expectedProvenance)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expectedErr
			}
			_, err := sut.CreateTimeInterval(context.Background(), ti, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			_, err := sut.CreateTimeInterval(context.Background(), ti, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
				return expectedErr
			}

			_, err := sut.CreateTimeInterval(context.Background(), ti, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func TestUpdateTimeIntervals(t *testing.T) {
	orgID := int64(1)

	initialConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			TemplateFiles: nil,
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					TimeIntervals: []config.TimeInterval{
						{
							Name: "Test",
						},
					},
				},
				Receivers: nil,
			},
		}
	}

	expected := config.TimeInterval{
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
	ti := definitions.TimeInterval{
		TimeInterval: expected,
		Provenance:   definitions.Provenance(expectedProvenance),
	}

	t.Run("rejects time interval that fail validation", func(t *testing.T) {
		sut, _, _ := createTimeIntervalSvcSut()
		ti := definitions.TimeInterval{
			TimeInterval: config.TimeInterval{
				Name: "",
			},
			Provenance: definitions.Provenance(models.ProvenanceFile),
		}

		_, err := sut.UpdateTimeInterval(context.Background(), ti, orgID)

		require.Truef(t, ErrTimeIntervalInvalid.Base.Is(err), "expected ErrTimeIntervalInvalid but got %s", err)
	})

	t.Run("returns ErrTimeIntervalNotFound if time interval does not exist", func(t *testing.T) {
		sut, store, _ := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}

		ti := definitions.TimeInterval{
			TimeInterval: config.TimeInterval{
				Name: "No-ti",
			},
			Provenance: definitions.Provenance(models.ProvenanceFile),
		}

		_, err := sut.UpdateTimeInterval(context.Background(), ti, orgID)

		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("saves time interval and provenance in a transaction", func(t *testing.T) {
		sut, store, prov := createTimeIntervalSvcSut()
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

		result, err := sut.UpdateTimeInterval(context.Background(), ti, orgID)
		require.NoError(t, err)

		require.EqualValues(t, expected, result.TimeInterval)
		require.EqualValues(t, expectedProvenance, result.Provenance)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		require.EqualValues(t, []config.TimeInterval{expected}, revision.cfg.AlertmanagerConfig.TimeIntervals)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, &ti, orgID, expectedProvenance)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expectedErr
			}
			_, err := sut.UpdateTimeInterval(context.Background(), ti, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			_, err := sut.UpdateTimeInterval(context.Background(), ti, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
				return expectedErr
			}

			_, err := sut.UpdateTimeInterval(context.Background(), ti, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func TestDeleteTimeIntervals(t *testing.T) {
	orgID := int64(1)

	timeIntervalToDelete := config.TimeInterval{Name: "unused-time-interval"}
	usedTimeInterval := "used-time-interval"
	initialConfig := func() *definitions.PostableUserConfig {
		return &definitions.PostableUserConfig{
			TemplateFiles: nil,
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{
						MuteTimeIntervals: []string{usedTimeInterval},
					},
					TimeIntervals: []config.TimeInterval{
						{
							Name: usedTimeInterval,
						},
						timeIntervalToDelete,
					},
				},
				Receivers: nil,
			},
		}
	}

	t.Run("re-saves config and deletes provenance if time interval does not exist", func(t *testing.T) {
		sut, store, prov := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Return(nil)

		err := sut.DeleteTimeInterval(context.Background(), "no-time-interval", orgID)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		require.EqualValues(t, initialConfig().AlertmanagerConfig.TimeIntervals, revision.cfg.AlertmanagerConfig.TimeIntervals)

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, &definitions.TimeInterval{TimeInterval: config.TimeInterval{Name: "no-time-interval"}}, orgID)
	})

	t.Run("returns ErrTimeIntervalInUse if time interval is used", func(t *testing.T) {
		sut, store, _ := createTimeIntervalSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
			return &cfgRevision{cfg: initialConfig()}, nil
		}

		err := sut.DeleteTimeInterval(context.Background(), usedTimeInterval, orgID)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.Truef(t, ErrTimeIntervalInUse.Is(err), "expected ErrTimeIntervalInUse but got %s", err)
	})

	t.Run("deletes time interval and provenance in transaction", func(t *testing.T) {
		sut, store, prov := createTimeIntervalSvcSut()
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

		err := sut.DeleteTimeInterval(context.Background(), timeIntervalToDelete.Name, orgID)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*cfgRevision)

		expectedTimeIntervals := slices.DeleteFunc(initialConfig().AlertmanagerConfig.TimeIntervals, func(interval config.TimeInterval) bool {
			return interval.Name == timeIntervalToDelete.Name
		})
		require.EqualValues(t, expectedTimeIntervals, revision.cfg.AlertmanagerConfig.TimeIntervals)

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, &definitions.TimeInterval{TimeInterval: timeIntervalToDelete}, orgID)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return nil, expectedErr
			}
			err := sut.DeleteTimeInterval(context.Background(), timeIntervalToDelete.Name, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			err := sut.DeleteTimeInterval(context.Background(), timeIntervalToDelete.Name, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, _ := createTimeIntervalSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*cfgRevision, error) {
				return &cfgRevision{cfg: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *cfgRevision) error {
				return expectedErr
			}

			err := sut.DeleteTimeInterval(context.Background(), timeIntervalToDelete.Name, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func createTimeIntervalSvcSut() (*TimeIntervalService, *alertmanagerConfigStoreFake, *MockProvisioningStore) {
	store := &alertmanagerConfigStoreFake{}
	prov := &MockProvisioningStore{}
	return &TimeIntervalService{
		configStore:     store,
		provenanceStore: prov,
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
	}, store, prov
}
