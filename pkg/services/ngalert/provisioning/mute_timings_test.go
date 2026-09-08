package provisioning

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/alertmanager/timeinterval"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/routes"
)

func TestGetMuteTimings(t *testing.T) {
	orgID := int64(1)
	revision := &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			TimeIntervals: map[v1.ResourceUID]v1.TimeInterval{
				v1.TimeIntervalUID("Test1"): v1.NewTimeInterval("Test1", nil, models.ProvenanceNone),
				v1.TimeIntervalUID("Test2"): v1.NewTimeInterval("Test2", nil, models.ProvenanceNone),
				v1.TimeIntervalUID("Test3"): v1.NewTimeInterval("Test3", nil, models.ProvenanceNone),
			},
		},
	}

	provenances := map[string]models.Provenance{
		"Test1": models.ProvenanceFile,
		"Test2": models.ProvenanceAPI,
	}

	t.Run("service returns timings from config file", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(provenances, nil)

		result, err := sut.GetMuteTimings(context.Background(), 1)

		require.NoError(t, err)
		require.Len(t, result, len(revision.Config.TimeIntervals))
		require.Equal(t, "Test1", result[0].Title)
		require.EqualValues(t, provenances["Test1"], result[0].Provenance)
		require.NotEmpty(t, result[0].Version)
		require.Equal(t, v1.TimeIntervalUID(result[0].Title), result[0].UID)

		require.Equal(t, "Test2", result[1].Title)
		require.EqualValues(t, provenances["Test2"], result[1].Provenance)
		require.NotEmpty(t, result[1].Version)
		require.Equal(t, v1.TimeIntervalUID(result[1].Title), result[1].UID)

		require.Equal(t, "Test3", result[2].Title)
		require.EqualValues(t, "", result[2].Provenance)
		require.NotEmpty(t, result[2].Version)
		require.Equal(t, v1.TimeIntervalUID(result[2].Title), result[2].UID)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&v1.TimeInterval{}).ResourceType())
	})

	t.Run("service returns empty list when config file contains no mute timings", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: &v1.AMConfigV1{}}, nil
		}

		result, err := sut.GetMuteTimings(context.Background(), 1)

		require.NoError(t, err)
		require.Empty(t, result)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expected := fmt.Errorf("failed")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expected
			}

			_, err := sut.GetMuteTimings(context.Background(), orgID)

			require.ErrorIs(t, err, expected)
		})

		t.Run("when unable to read provenance", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}
			expected := fmt.Errorf("failed")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, expected)

			_, err := sut.GetMuteTimings(context.Background(), orgID)

			require.ErrorIs(t, err, expected)
		})
	})

	t.Run("with imported intervals", func(t *testing.T) {
		grafanaIntervals := []v1.TimeInterval{
			{Title: "grafana-interval"},
		}
		importedIntervals := []v1.TimeInterval{
			{Title: "imported-interval"},
		}
		revision := createConfigWithImportedIntervals(grafanaIntervals, importedIntervals)

		provenances := map[string]models.Provenance{
			"grafana-interval": models.ProvenanceAPI,
		}

		t.Run("returns only Grafana intervals without WithIncludeImported", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(provenances, nil)

			result, err := sut.GetMuteTimings(context.Background(), orgID)

			require.NoError(t, err)
			require.Len(t, result, 1)
			require.Equal(t, "grafana-interval", result[0].Title)
			require.EqualValues(t, models.ProvenanceAPI, result[0].Provenance)
		})

		t.Run("returns both Grafana and imported intervals with WithIncludeImported", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			sut = sut.WithIncludeImported()

			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(provenances, nil)

			result, err := sut.GetMuteTimings(context.Background(), orgID)

			require.NoError(t, err)
			require.Len(t, result, 2)

			// Find Grafana interval
			var grafanaInterval *v1.TimeInterval
			var importedInterval *v1.TimeInterval
			for i := range result {
				switch name := result[i].Title; name {
				case "grafana-interval":
					grafanaInterval = &result[i]
				case "imported-interval":
					importedInterval = &result[i]
				}
			}

			require.NotNil(t, grafanaInterval, "Grafana interval not found")
			require.NotNil(t, importedInterval, "Imported interval not found")

			// Verify Grafana interval
			require.Equal(t, "grafana-interval", grafanaInterval.Title)
			require.EqualValues(t, models.ProvenanceAPI, grafanaInterval.Provenance)
			require.Equal(t, v1.TimeIntervalUID(grafanaInterval.Title), grafanaInterval.UID)

			// Verify imported interval
			require.Equal(t, "imported-interval", importedInterval.Title)
			require.EqualValues(t, models.ProvenanceConvertedPrometheus, importedInterval.Provenance)
			require.Equal(t, v1.TimeIntervalUID(importedInterval.Title), importedInterval.UID)
		})

		t.Run("handles empty ExtraConfigs", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			sut = sut.WithIncludeImported()

			emptyRevision := createConfigWithImportedIntervals(grafanaIntervals, nil)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return emptyRevision, nil
			}
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(provenances, nil)

			result, err := sut.GetMuteTimings(context.Background(), orgID)

			require.NoError(t, err)
			require.Len(t, result, 1)
			require.Equal(t, "grafana-interval", result[0].Title)
		})
	})
}

func TestGetMuteTimingByName(t *testing.T) {
	orgID := int64(1)
	revision := &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			TimeIntervals: map[v1.ResourceUID]v1.TimeInterval{
				v1.TimeIntervalUID("Test1"): v1.NewTimeInterval("Test1", nil, models.ProvenanceNone),
				v1.TimeIntervalUID("Test2"): v1.NewTimeInterval("Test2", nil, models.ProvenanceNone),
			},
		},
	}

	t.Run("service returns timing by name", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{"Test1": models.ProvenanceAPI}, nil)

		result, err := sut.GetMuteTimingByName(context.Background(), "Test1", orgID)

		require.NoError(t, err)

		require.Equal(t, "Test1", result.Title)
		require.EqualValues(t, models.ProvenanceAPI, result.Provenance)
		require.Equal(t, v1.TimeIntervalUID(result.Title), result.UID)
		require.NotEmpty(t, result.Version)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		prov.AssertCalled(t, "GetProvenances", mock.Anything, orgID, (&v1.TimeInterval{}).ResourceType())

		t.Run("service returns ErrTimeIntervalNotFound if no mute timing by name", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

			_, err := sut.GetMuteTimingByName(context.Background(), "Test123", orgID)

			require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
		})

		t.Run("service propagates errors", func(t *testing.T) {
			t.Run("when unable to read config", func(t *testing.T) {
				sut, store, _ := createMuteTimingSvcSut()
				expected := fmt.Errorf("failed")
				store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
					return nil, expected
				}

				_, err := sut.GetMuteTimingByName(context.Background(), "Test1", orgID)

				require.ErrorIs(t, err, expected)
			})

			t.Run("when unable to read provenance", func(t *testing.T) {
				sut, store, prov := createMuteTimingSvcSut()
				store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
					return revision, nil
				}
				expected := fmt.Errorf("failed")
				prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, expected)

				_, err := sut.GetMuteTimingByName(context.Background(), "Test1", orgID)

				require.ErrorIs(t, err, expected)
			})
		})
	})
}

func TestGetMuteTimingByUID(t *testing.T) {
	orgID := int64(1)
	revision := &legacy_storage.ConfigRevision{
		Config: &v1.AMConfigV1{
			TimeIntervals: map[v1.ResourceUID]v1.TimeInterval{
				v1.TimeIntervalUID("Test1"): v1.NewTimeInterval("Test1", nil, models.ProvenanceNone),
				v1.TimeIntervalUID("Test2"): v1.NewTimeInterval("Test2", nil, models.ProvenanceNone),
			},
		},
	}

	t.Run("service returns timing by UID", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return revision, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{"Test1": models.ProvenanceAPI}, nil)
		result, err := sut.GetMuteTimingByUID(context.Background(), v1.TimeIntervalUID("Test1"), orgID)

		require.NoError(t, err)

		require.Equal(t, "Test1", result.Title)
		require.Equal(t, v1.TimeIntervalUID("Test1"), result.UID)
		require.EqualValues(t, models.ProvenanceAPI, result.Provenance)
	})

	t.Run("service returns ErrTimeIntervalNotFound if no mute timings", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: &v1.AMConfigV1{}}, nil
		}

		_, err := sut.GetMuteTimingByUID(context.Background(), "Test1", orgID)

		require.Truef(t, ErrTimeIntervalNotFound.Is(err), "expected ErrTimeIntervalNotFound but got %s", err)
	})

	t.Run("service propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expected := fmt.Errorf("failed")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expected
			}

			_, err := sut.GetMuteTimingByUID(context.Background(), v1.TimeIntervalUID("Test1"), orgID)

			require.ErrorIs(t, err, expected)
		})

		t.Run("when unable to read provenance", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return revision, nil
			}
			expected := fmt.Errorf("failed")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(nil, expected)

			_, err := sut.GetMuteTimingByUID(context.Background(), v1.TimeIntervalUID("Test1"), orgID)

			require.ErrorIs(t, err, expected)
		})
	})
}

func TestCreateMuteTimings(t *testing.T) {
	orgID := int64(1)

	initialConfig := func() *v1.AMConfigV1 {
		return &v1.AMConfigV1{
			Templates: nil,
			TimeIntervals: map[v1.ResourceUID]v1.TimeInterval{
				v1.TimeIntervalUID("TEST"): {
					ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("TEST")},
					Title:            "TEST",
				},
				v1.TimeIntervalUID("TEST2"): {
					ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("TEST2")},
					Title:            "TEST2",
				},
			},
		}
	}

	expected := v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("Test")},
		Title:            "Test",
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
	timing := v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("Test"), Provenance: expectedProvenance},
		Title:            expected.Title,
		TimeIntervals:    expected.TimeIntervals,
	}

	t.Run("returns ErrTimeIntervalInvalid if mute timings fail validation", func(t *testing.T) {
		sut, _, _ := createMuteTimingSvcSut()
		timing := v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{Provenance: models.ProvenanceFile},
			Title:            "",
		}

		_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalInvalid.Base.Is(err), "expected ErrTimeIntervalInvalid but got %s", err)
	})

	t.Run("returns ErrTimeIntervalExists if mute timing with the name exists", func(t *testing.T) {
		sut, store, _ := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}

		existing := initialConfig().TimeIntervals[v1.TimeIntervalUID("TEST")]
		existing.Provenance = models.ProvenanceFile
		timing := existing

		_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalExists.Is(err), "expected ErrTimeIntervalExists but got %s", err)

		existing = initialConfig().TimeIntervals[v1.TimeIntervalUID("TEST2")]
		existing.Provenance = models.ProvenanceFile
		timing = existing

		_, err = sut.CreateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalExists.Is(err), "expected ErrTimeIntervalExists but got %s", err)
	})

	t.Run("saves mute timing and provenance in a transaction", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
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

		require.EqualValues(t, expected.Title, result.Title)
		require.EqualValues(t, expected.TimeIntervals, result.TimeIntervals)
		require.EqualValues(t, expectedProvenance, result.Provenance)
		require.Equal(t, v1.TimeIntervalUID(expected.Title), result.UID)
		require.NotEmpty(t, result.Version)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

		stored, ok := revision.Config.TimeIntervals[v1.TimeIntervalUID(expected.Title)]
		require.True(t, ok, "created interval should be stored")
		require.Equal(t, expected.Title, stored.Title)
		require.EqualValues(t, expected.TimeIntervals, stored.TimeIntervals)
		// Existing intervals are preserved.
		require.Contains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID("TEST"))
		require.Contains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID("TEST2"))
		require.Len(t, revision.Config.TimeIntervals, 3)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, &result, orgID, expectedProvenance)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			expectedErr := errors.New("test-err")
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}
			_, err := sut.CreateMuteTiming(context.Background(), timing, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
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
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
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

	original := v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("Test")},
		Title:            "Test",
	}
	originalVersion := v1.TimeIntervalFingerprint(original)
	initialConfig := func() *v1.AMConfigV1 {
		return &v1.AMConfigV1{
			Templates: nil,
			TimeIntervals: map[v1.ResourceUID]v1.TimeInterval{
				v1.TimeIntervalUID("Test"):  v1.NewTimeInterval("Test", nil, models.ProvenanceNone),
				v1.TimeIntervalUID("Test2"): v1.NewTimeInterval("Test2", nil, models.ProvenanceNone),
			},
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Route: &v1.Route{
						Routes: []*v1.Route{
							{
								MuteTimeIntervals: []string{original.Title},
							},
						},
					},
				},
				Receivers: nil,
			},
		}
	}

	expected := v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("Test")},
		Title:            "Test",
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
	expectedVersion := v1.TimeIntervalFingerprint(expected)
	expectedUID := v1.TimeIntervalUID(expected.Title)
	timing := v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID(expected.Title), Version: originalVersion, Provenance: expectedProvenance},
		Title:            expected.Title,
		TimeIntervals:    expected.TimeIntervals,
	}

	t.Run("rejects mute timings that fail validation", func(t *testing.T) {
		sut, _, _ := createMuteTimingSvcSut()
		timing := v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{Provenance: models.ProvenanceFile},
			Title:            "",
		}

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

		require.Truef(t, ErrTimeIntervalInvalid.Base.Is(err), "expected ErrTimeIntervalInvalid but got %s", err)
	})

	t.Run("rejects mute timings if provenance is not right", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		expectedErr := errors.New("test")
		sut.validator = func(_ context.Context, from, to models.Provenance) error {
			return expectedErr
		}
		timing := expected
		timing.Provenance = models.ProvenanceFile

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("rejects mute timings if new name already exists", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		sut.validator = func(_ context.Context, from, to models.Provenance) error {
			return nil
		}
		timing := v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("Test2"), Provenance: expectedProvenance},
			Title:            "Test",
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

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.ErrorIs(t, err, ErrTimeIntervalExists)
	})

	t.Run("returns ErrVersionConflict if storage version does not match", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}

		timing := expected
		timing.Version = "some_random_version"
		timing.Provenance = expectedProvenance

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

		require.ErrorIs(t, err, ErrVersionConflict)
	})

	t.Run("returns ErrMuteTimingsNotFound if mute timing does not exist", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)

		t.Run("when UID is specified", func(t *testing.T) {
			timing := expected
			timing.UID = "not-found"
			timing.Provenance = expectedProvenance

			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, ErrTimeIntervalNotFound)
		})

		t.Run("when only Name is specified", func(t *testing.T) {
			timing := v1.TimeInterval{
				ResourceMetadata: v1.ResourceMetadata{Provenance: expectedProvenance},
				Title:            "not-found",
			}

			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, ErrTimeIntervalNotFound)
		})
	})

	t.Run("saves mute timing and provenance in a transaction if optimistic concurrency passes", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64, _ models.Provenance) error {
				assertInTransaction(t, ctx)
				return nil
			})

		result, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.NoError(t, err)

		require.EqualValues(t, expected.Title, result.Title)
		require.EqualValues(t, expected.TimeIntervals, result.TimeIntervals)
		require.EqualValues(t, expectedProvenance, result.Provenance)
		require.EqualValues(t, expectedVersion, result.Version)
		require.Equal(t, v1.TimeIntervalUID(result.Title), result.UID)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

		stored, ok := revision.Config.TimeIntervals[v1.TimeIntervalUID(expected.Title)]
		require.True(t, ok)
		require.Equal(t, expected.Title, stored.Title)
		require.EqualValues(t, expected.TimeIntervals, stored.TimeIntervals)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, mock.MatchedBy(func(m *v1.TimeInterval) bool { return m.Title == timing.Title }), orgID, expectedProvenance)

		t.Run("bypass optimistic concurrency check if version is empty", func(t *testing.T) {
			store.Calls = nil
			timing := v1.TimeInterval{
				ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID(expected.Title), Provenance: expectedProvenance},
				Title:            expected.Title,
				TimeIntervals: []timeinterval.TimeInterval{
					{Months: []timeinterval.MonthRange{
						{
							InclusiveRange: timeinterval.InclusiveRange{
								Begin: 1,
								End:   10,
							},
						}},
					},
				},
			}
			expectedVersion := v1.TimeIntervalFingerprint(timing)

			result, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
			require.NoError(t, err)

			require.EqualValues(t, timing.Title, result.Title)
			require.EqualValues(t, timing.TimeIntervals, result.TimeIntervals)
			require.Equal(t, expectedVersion, result.Version)
			require.EqualValues(t, expectedProvenance, result.Provenance)

			require.Equal(t, "Save", store.Calls[1].Method)
			require.Equal(t, orgID, store.Calls[1].Args[2])
			revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

			stored, ok := revision.Config.TimeIntervals[v1.TimeIntervalUID(expected.Title)]
			require.True(t, ok)
			require.Equal(t, timing.Title, stored.Title)
			require.EqualValues(t, timing.TimeIntervals, stored.TimeIntervals)
		})
	})

	t.Run("updates time interval where it is", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		original := initialConfig().TimeIntervals[v1.TimeIntervalUID("Test2")]

		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{original.Title: expectedProvenance}, nil)
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64, _ models.Provenance) error {
				assertInTransaction(t, ctx)
				return nil
			})

		expected := expected
		expected.Title = original.Title
		expected.UID = original.UID
		timing := timing
		timing.Title = expected.Title
		timing.UID = expected.UID
		timing.TimeIntervals = expected.TimeIntervals
		timing.Version = v1.TimeIntervalFingerprint(original)
		expectedVersion := v1.TimeIntervalFingerprint(expected)

		result, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.NoError(t, err)

		require.EqualValues(t, expected.Title, result.Title)
		require.EqualValues(t, expected.TimeIntervals, result.TimeIntervals)
		require.EqualValues(t, expectedProvenance, result.Provenance)
		require.EqualValues(t, expectedVersion, result.Version)
		require.Equal(t, v1.TimeIntervalUID(result.Title), result.UID)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

		stored, ok := revision.Config.TimeIntervals[v1.TimeIntervalUID(expected.Title)]
		require.True(t, ok)
		require.Equal(t, expected.Title, stored.Title)
		require.EqualValues(t, expected.TimeIntervals, stored.TimeIntervals)

		prov.AssertCalled(t, "SetProvenance", mock.Anything, mock.MatchedBy(func(m *v1.TimeInterval) bool { return m.Title == timing.Title }), orgID, expectedProvenance)
	})

	t.Run("renames interval and all its dependencies", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()

		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
		prov.EXPECT().GetProvenance(mock.Anything, mock.MatchedBy(func(*v1.Route) bool { return true }), mock.Anything).Return(expectedProvenance, nil).Maybe()
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).RunAndReturn(func(ctx context.Context, provisionable models.Provisionable, i int64) error {
			assertInTransaction(t, ctx)
			return nil
		})
		prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64, _ models.Provenance) error {
				assertInTransaction(t, ctx)
				return nil
			})

		ruleStore := &fakeAlertRuleNotificationStore{
			RenameTimeIntervalInNotificationSettingsFn: func(ctx context.Context, orgID int64, old, new string, validate func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
				assertInTransaction(t, ctx)
				return nil, nil, nil
			},
		}
		sut.ruleNotificationsStore = ruleStore

		interval := expected
		interval.Title = "another-time-interval"
		timing := v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: expectedUID, Version: originalVersion, Provenance: expectedProvenance},
			Title:            interval.Title,
			TimeIntervals:    interval.TimeIntervals,
		}

		result, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.NoError(t, err)

		require.EqualValues(t, interval.Title, result.Title)
		require.EqualValues(t, interval.TimeIntervals, result.TimeIntervals)
		require.EqualValues(t, expectedProvenance, result.Provenance)
		require.EqualValues(t, v1.TimeIntervalFingerprint(interval), result.Version)
		// The UID is derived from the title, so a rename moves the interval to a new UID.
		require.Equal(t, v1.TimeIntervalUID(interval.Title), result.UID)
		require.NotEqual(t, expectedUID, result.UID)

		require.Len(t, ruleStore.Calls, 1)
		assert.Equal(t, "RenameTimeIntervalInNotificationSettings", ruleStore.Calls[0].Method)
		assert.Equal(t, orgID, ruleStore.Calls[0].Args[1])
		assert.Equal(t, original.Title, ruleStore.Calls[0].Args[2])
		assert.Equal(t, interval.Title, ruleStore.Calls[0].Args[3])
		assert.NotNil(t, ruleStore.Calls[0].Args[4])
		assert.False(t, ruleStore.Calls[0].Args[5].(bool))

		prov.AssertCalled(t, "SetProvenance", mock.Anything, mock.MatchedBy(func(m *v1.TimeInterval) bool {
			return m.Title == interval.Title
		}), orgID, expectedProvenance)
		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(m *v1.TimeInterval) bool {
			return m.Title == original.Title
		}), orgID)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		assert.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		assert.Equal(t, orgID, store.Calls[1].Args[2])

		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)
		// The renamed interval is stored under its new UID with the new title.
		renamed, hasNew := revision.Config.TimeIntervals[v1.TimeIntervalUID(interval.Title)]
		require.Truef(t, hasNew, "renamed time interval should be present under its new UID")
		assert.Equal(t, interval.Title, renamed.Title)
		// The interval previously stored under the original name is no longer referenced by its old title.
		_, stillOld := revision.Config.TimeIntervals[expectedUID]
		assert.False(t, stillOld || hasTimeIntervalWithTitle(revision.Config.TimeIntervals, original.Title), "old time interval should no longer be present under its original title")
		assert.Falsef(t, revision.TimeIntervalUsedByRoutes(expected.Title), "There are still references to the old time interval")
		assert.Truef(t, revision.TimeIntervalUsedByRoutes(interval.Title), "There are no references to the new time interval")
	})

	t.Run("returns ErrTimeIntervalDependentResourcesProvenance if route has different provenance status", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()

		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
		prov.EXPECT().GetProvenance(mock.Anything, mock.MatchedBy(func(*v1.Route) bool { return true }), mock.Anything).Return(models.ProvenanceFile, nil)

		ruleStore := &fakeAlertRuleNotificationStore{
			RenameTimeIntervalInNotificationSettingsFn: func(ctx context.Context, orgID int64, old, new string, validate func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
				assertInTransaction(t, ctx)
				return nil, nil, nil
			},
		}
		sut.ruleNotificationsStore = ruleStore

		interval := expected
		interval.Title = "another-time-interval"
		timing := v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: expectedUID, Version: originalVersion, Provenance: expectedProvenance},
			Title:            interval.Title,
			TimeIntervals:    interval.TimeIntervals,
		}

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.ErrorIs(t, err, ErrTimeIntervalDependentResourcesProvenance)

		require.Len(t, ruleStore.Calls, 1)
		assert.Equal(t, "RenameTimeIntervalInNotificationSettings", ruleStore.Calls[0].Method)
		assert.Equal(t, orgID, ruleStore.Calls[0].Args[1])
		assert.Equal(t, original.Title, ruleStore.Calls[0].Args[2])
		assert.Equal(t, interval.Title, ruleStore.Calls[0].Args[3])
		assert.NotNil(t, ruleStore.Calls[0].Args[4])
		assert.True(t, ruleStore.Calls[0].Args[5].(bool)) // still check if there are rules that have incompatible provenance
	})

	t.Run("returns ErrTimeIntervalDependentResourcesProvenance if rules have different provenance status", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()

		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
		prov.EXPECT().GetProvenance(mock.Anything, mock.MatchedBy(func(*v1.Route) bool { return true }), mock.Anything).Return(models.ProvenanceNone, nil)

		ruleStore := &fakeAlertRuleNotificationStore{
			RenameTimeIntervalInNotificationSettingsFn: func(ctx context.Context, orgID int64, old, new string, validate func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
				assertInTransaction(t, ctx)
				return nil, []models.AlertRuleKey{models.GenerateRuleKey(orgID)}, nil
			},
		}
		sut.ruleNotificationsStore = ruleStore

		interval := expected
		interval.Title = "another-time-interval"
		timing := v1.TimeInterval{
			ResourceMetadata: v1.ResourceMetadata{UID: expectedUID, Version: originalVersion, Provenance: expectedProvenance},
			Title:            interval.Title,
			TimeIntervals:    interval.TimeIntervals,
		}

		_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
		require.ErrorIs(t, err, ErrTimeIntervalDependentResourcesProvenance)

		require.Len(t, ruleStore.Calls, 1)
		assert.Equal(t, "RenameTimeIntervalInNotificationSettings", ruleStore.Calls[0].Method)
		assert.Equal(t, orgID, ruleStore.Calls[0].Args[1])
		assert.Equal(t, original.Title, ruleStore.Calls[0].Args[2])
		assert.Equal(t, interval.Title, ruleStore.Calls[0].Args[3])
		assert.NotNil(t, ruleStore.Calls[0].Args[4])
		assert.False(t, ruleStore.Calls[0].Args[5].(bool))
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			expectedErr := errors.New("test-err")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil).Maybe()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}
			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, _ := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				GetProvenances(mock.Anything, mock.Anything, mock.Anything).
				Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
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
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
			}
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				GetProvenances(mock.Anything, mock.Anything, mock.Anything).
				Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
				return expectedErr
			}

			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when RenameTimeIntervalInNotificationSettings fails", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
			}
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{expected.Title: expectedProvenance}, nil)
			prov.EXPECT().GetProvenance(mock.Anything, mock.MatchedBy(func(*v1.Route) bool { return true }), mock.Anything).Return(expectedProvenance, nil).Maybe()
			prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()
			prov.EXPECT().SetProvenance(mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return(nil).Maybe()
			expectedErr := errors.New("test-err")

			ruleStore := &fakeAlertRuleNotificationStore{
				RenameTimeIntervalInNotificationSettingsFn: func(ctx context.Context, orgID int64, old, new string, validate func(models.Provenance) bool, dryRun bool) ([]models.AlertRuleKey, []models.AlertRuleKey, error) {
					return nil, nil, expectedErr
				},
			}
			sut.ruleNotificationsStore = ruleStore

			interval := expected
			interval.Title = "another-time-interval"
			timing := v1.TimeInterval{
				ResourceMetadata: v1.ResourceMetadata{UID: expectedUID, Version: originalVersion, Provenance: expectedProvenance},
				Title:            interval.Title,
				TimeIntervals:    interval.TimeIntervals,
			}

			_, err := sut.UpdateMuteTiming(context.Background(), timing, orgID)
			require.ErrorIs(t, err, expectedErr)
		})
	})
}

func TestDeleteMuteTimings(t *testing.T) {
	orgID := int64(1)

	timingToDelete := v1.TimeInterval{ResourceMetadata: v1.ResourceMetadata{UID: v1.TimeIntervalUID("unused-timing")}, Title: "unused-timing"}
	correctVersion := v1.TimeIntervalFingerprint(timingToDelete)
	usedMuteTiming := "used-timing"
	usedActiveTiming := "used-active-timing"
	managedRouteMuteTiming := "managed-route-used-timing"
	managedRouteActiveTiming := "managed-route-used-active-timing"
	initialConfig := func() *v1.AMConfigV1 {
		return &v1.AMConfigV1{
			Templates: nil,
			TimeIntervals: map[v1.ResourceUID]v1.TimeInterval{
				v1.TimeIntervalUID(usedMuteTiming):           v1.NewTimeInterval(usedMuteTiming, nil, models.ProvenanceNone),
				v1.TimeIntervalUID(timingToDelete.Title):     v1.NewTimeInterval(timingToDelete.Title, nil, models.ProvenanceNone),
				v1.TimeIntervalUID(usedActiveTiming):         v1.NewTimeInterval(usedActiveTiming, nil, models.ProvenanceNone),
				v1.TimeIntervalUID("timing-to-delete2"):      v1.NewTimeInterval("timing-to-delete2", nil, models.ProvenanceNone),
				v1.TimeIntervalUID(managedRouteMuteTiming):   v1.NewTimeInterval(managedRouteMuteTiming, nil, models.ProvenanceNone),
				v1.TimeIntervalUID(managedRouteActiveTiming): v1.NewTimeInterval(managedRouteActiveTiming, nil, models.ProvenanceNone),
			},
			AlertmanagerConfig: v1.PostableApiAlertingConfig{
				Config: v1.Config{
					Route: &v1.Route{
						MuteTimeIntervals:   []string{usedMuteTiming},
						ActiveTimeIntervals: []string{usedActiveTiming},
					},
				},
				Receivers: nil,
			},
			ManagedRoutes: map[string]*v1.Route{
				"managed-route": {
					Routes: []*v1.Route{
						{
							MuteTimeIntervals:   []string{managedRouteMuteTiming},
							ActiveTimeIntervals: []string{managedRouteActiveTiming},
						},
					},
				},
			},
		}
	}

	t.Run("fails if provenance check fails", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		expectedErr := errors.New("test")
		sut.validator = func(_ context.Context, from, to models.Provenance) error {
			return expectedErr
		}
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, models.ProvenanceNone, correctVersion)
		require.ErrorIs(t, err, expectedErr)
	})

	t.Run("returns ErrTimeIntervalInUse if mute timing is used by a route", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		err := sut.DeleteMuteTiming(context.Background(), usedMuteTiming, orgID, models.ProvenanceAPI, correctVersion)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.ErrorIs(t, err, ErrTimeIntervalInUse)
	})

	t.Run("returns ErrTimeIntervalInUse if active timing is used by a route", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		err := sut.DeleteMuteTiming(context.Background(), usedActiveTiming, orgID, models.ProvenanceAPI, correctVersion)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.ErrorIs(t, err, ErrTimeIntervalInUse)
	})

	t.Run("returns ErrTimeIntervalInUse if mute timing is used by a managed route", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		version := v1.TimeIntervalFingerprint(v1.TimeInterval{Title: managedRouteMuteTiming})
		err := sut.DeleteMuteTiming(context.Background(), managedRouteMuteTiming, orgID, models.ProvenanceAPI, version)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.ErrorIs(t, err, ErrTimeIntervalInUse)
	})

	t.Run("returns ErrTimeIntervalInUse if active timing is used by a managed route", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		version := v1.TimeIntervalFingerprint(v1.TimeInterval{Title: managedRouteActiveTiming})
		err := sut.DeleteMuteTiming(context.Background(), managedRouteActiveTiming, orgID, models.ProvenanceAPI, version)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.ErrorIs(t, err, ErrTimeIntervalInUse)
	})

	t.Run("returns ErrTimeIntervalInUse if mute timing is used by rules", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		ruleKey := models.GenerateRuleKey(orgID)
		ruleNsStore := fakeAlertRuleNotificationStore{
			ListContactPointRoutingsFn: func(ctx context.Context, q models.ListContactPointRoutingsQuery) (map[models.AlertRuleKey]models.ContactPointRouting, error) {
				assertInTransaction(t, ctx)
				assert.Equal(t, orgID, q.OrgID)
				assert.Equal(t, timingToDelete.Title, q.TimeIntervalName)
				assert.Empty(t, q.ReceiverName)
				return map[models.AlertRuleKey]models.ContactPointRouting{
					ruleKey: {},
				}, nil
			},
		}
		sut.ruleNotificationsStore = &ruleNsStore
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, models.ProvenanceAPI, correctVersion)

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.ErrorIs(t, err, ErrTimeIntervalInUse)
		require.Len(t, ruleNsStore.Calls, 1)
		require.Equal(t, "ListContactPointRoutings", ruleNsStore.Calls[0].Method)

		var gfErr errutil.Error
		require.ErrorAs(t, err, &gfErr)
		require.Contains(t, gfErr.LogMessage, ruleKey.UID)
	})

	t.Run("returns ErrVersionConflict if provided version does not match", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)

		err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, models.ProvenanceAPI, "test-version")

		require.Len(t, store.Calls, 1)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])
		require.ErrorIs(t, err, ErrVersionConflict)
	})

	t.Run("deletes mute timing and provenance in transaction if passes optimistic concurrency check", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64) error {
				assertInTransaction(t, ctx)
				return nil
			})

		err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, "", correctVersion)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

		assert.NotContains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(timingToDelete.Title))
		// Other intervals are preserved.
		assert.Contains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(usedMuteTiming))

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(mt models.Provisionable) bool { return mt.ResourceID() == timingToDelete.ResourceID() }), orgID)

		t.Run("should bypass optimistic concurrency check if version is empty", func(t *testing.T) {
			store.Calls = nil
			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, "", "")
			require.NoError(t, err)

			require.Equal(t, "Save", store.Calls[1].Method)
			require.Equal(t, orgID, store.Calls[1].Args[2])
			revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

			assert.NotContains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(timingToDelete.Title))

			prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(mt models.Provisionable) bool { return mt.ResourceID() == timingToDelete.ResourceID() }), orgID)
		})
	})

	t.Run("deletes time interval and provenance", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64) error {
				assertInTransaction(t, ctx)
				return nil
			})

		timingToDelete := initialConfig().TimeIntervals[v1.TimeIntervalUID("timing-to-delete2")]
		correctVersion := v1.TimeIntervalFingerprint(timingToDelete)

		err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, "", correctVersion)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

		assert.NotContains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(timingToDelete.Title))
		// Other intervals are preserved.
		assert.Contains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(usedMuteTiming))
		assert.Contains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(usedActiveTiming))

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(mt models.Provisionable) bool { return mt.ResourceID() == timingToDelete.Title }), orgID)
	})

	t.Run("deletes mute timing and provenance by UID", func(t *testing.T) {
		sut, store, prov := createMuteTimingSvcSut()
		store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
			return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
		}
		store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
			assertInTransaction(t, ctx)
			return nil
		}
		prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)
		prov.EXPECT().DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).RunAndReturn(
			func(ctx context.Context, _ models.Provisionable, _ int64) error {
				assertInTransaction(t, ctx)
				return nil
			})

		uid := string(v1.TimeIntervalUID(timingToDelete.Title))

		err := sut.DeleteMuteTiming(context.Background(), uid, orgID, "", correctVersion)
		require.NoError(t, err)

		require.Len(t, store.Calls, 2)
		require.Equal(t, "Get", store.Calls[0].Method)
		require.Equal(t, orgID, store.Calls[0].Args[1])

		require.Equal(t, "Save", store.Calls[1].Method)
		require.Equal(t, orgID, store.Calls[1].Args[2])
		revision := store.Calls[1].Args[1].(*legacy_storage.ConfigRevision)

		assert.NotContains(t, revision.Config.TimeIntervals, v1.TimeIntervalUID(timingToDelete.Title))

		prov.AssertCalled(t, "DeleteProvenance", mock.Anything, mock.MatchedBy(func(mt models.Provisionable) bool { return mt.ResourceID() == timingToDelete.ResourceID() }), orgID)
	})

	t.Run("propagates errors", func(t *testing.T) {
		t.Run("when unable to read config", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			expectedErr := errors.New("test-err")
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return nil, expectedErr
			}
			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, "", "")
			require.ErrorIs(t, err, expectedErr)
		})

		t.Run("when provenance fails to save", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
			}
			expectedErr := fmt.Errorf("failed to save provenance")
			sut.provenanceStore.(*MockProvisioningStore).EXPECT().
				DeleteProvenance(mock.Anything, mock.Anything, mock.Anything).
				Return(expectedErr)

			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, "", "")

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})

		t.Run("when AM config fails to save", func(t *testing.T) {
			sut, store, prov := createMuteTimingSvcSut()
			prov.EXPECT().GetProvenances(mock.Anything, mock.Anything, mock.Anything).Return(map[string]models.Provenance{}, nil)
			store.GetFn = func(ctx context.Context, orgID int64) (*legacy_storage.ConfigRevision, error) {
				return &legacy_storage.ConfigRevision{Config: initialConfig()}, nil
			}
			expectedErr := errors.New("test-err")
			store.SaveFn = func(ctx context.Context, revision *legacy_storage.ConfigRevision) error {
				return expectedErr
			}

			err := sut.DeleteMuteTiming(context.Background(), timingToDelete.Title, orgID, "", "")

			require.ErrorIs(t, err, expectedErr)

			require.Len(t, store.Calls, 2)
			require.Equal(t, "Get", store.Calls[0].Method)
			require.Equal(t, orgID, store.Calls[0].Args[1])

			require.Equal(t, "Save", store.Calls[1].Method)
		})
	})
}

func createMuteTimingSvcSut() (*MuteTimingService, *legacy_storage.AlertmanagerConfigStoreFake, *MockProvisioningStore) {
	store := &legacy_storage.AlertmanagerConfigStoreFake{}
	prov := &MockProvisioningStore{}
	return &MuteTimingService{
		configStore:     store,
		provenanceStore: prov,
		xact:            newNopTransactionManager(),
		log:             log.NewNopLogger(),
		validator: func(_ context.Context, from, to models.Provenance) error {
			return nil
		},
		ruleNotificationsStore: &fakeAlertRuleNotificationStore{},
		routeService:           routes.NewFakeService(legacy_storage.ConfigRevision{}),
	}, store, prov
}

func hasTimeIntervalWithTitle(intervals map[v1.ResourceUID]v1.TimeInterval, title string) bool {
	for _, ti := range intervals {
		if ti.Title == title {
			return true
		}
	}
	return false
}

// buildMimirAMConfigWithTimeIntervals creates a Mimir alertmanager config YAML string
// containing the provided time intervals for use in ExtraConfigs.
// This generates a minimal but valid Prometheus alertmanager config with a route and receiver.
func buildMimirAMConfigWithTimeIntervals(intervals []v1.TimeInterval) string {
	if len(intervals) == 0 {
		return ""
	}

	// Start with required route and receivers
	yaml := "route:\n"
	yaml += "  receiver: test-receiver\n"
	yaml += "receivers:\n"
	yaml += "  - name: test-receiver\n"

	// Add time intervals
	yaml += "time_intervals:\n"
	for _, interval := range intervals {
		yaml += fmt.Sprintf("  - name: %s\n", interval.Title)
		if len(interval.TimeIntervals) > 0 {
			yaml += "    time_intervals:\n"
			for _, ti := range interval.TimeIntervals {
				yaml += "      -\n"
				if len(ti.Times) > 0 {
					yaml += "        times:\n"
					for _, tr := range ti.Times {
						yaml += fmt.Sprintf("          - start_time: '%02d:%02d'\n", tr.StartMinute/60, tr.StartMinute%60)
						yaml += fmt.Sprintf("            end_time: '%02d:%02d'\n", tr.EndMinute/60, tr.EndMinute%60)
					}
				}
				if len(ti.Weekdays) > 0 {
					yaml += "        weekdays:\n"
					for _, wd := range ti.Weekdays {
						// WeekdayRange uses InclusiveRange with Begin/End
						if wd.Begin == wd.End {
							yaml += fmt.Sprintf("          - %d\n", wd.Begin)
						} else {
							yaml += fmt.Sprintf("          - %d:%d\n", wd.Begin, wd.End)
						}
					}
				}
			}
		}
	}
	return yaml
}

// createConfigWithImportedIntervals creates a ConfigRevision with both Grafana and imported
// Mimir time intervals for testing.
func createConfigWithImportedIntervals(grafanaIntervals []v1.TimeInterval, importedIntervals []v1.TimeInterval) *legacy_storage.ConfigRevision {
	cfg := &v1.AMConfigV1{}
	for _, ti := range grafanaIntervals {
		if cfg.TimeIntervals == nil {
			cfg.TimeIntervals = make(map[v1.ResourceUID]v1.TimeInterval)
		}
		ti.UID = v1.TimeIntervalUID(ti.Title)
		cfg.TimeIntervals[ti.UID] = ti
	}

	if len(importedIntervals) > 0 {
		mimirConfig := buildMimirAMConfigWithTimeIntervals(importedIntervals)
		cfg.ExtraConfigs = []v1.ExtraConfiguration{
			{
				Identifier:         "test-mimir",
				AlertmanagerConfig: mimirConfig,
			},
		}
	}

	return &legacy_storage.ConfigRevision{Config: cfg}
}
