package legacy_storage

import (
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/notify"
	"github.com/grafana/alerting/notify/notifytest"
	"github.com/grafana/alerting/receivers/schema"
	"github.com/grafana/alerting/receivers/webhook"
	"github.com/prometheus/alertmanager/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func TestReceiverInUse(t *testing.T) {
	result := isReceiverInUse("test", []*definitions.Route{
		{
			Receiver: "not-test",
			Routes: []*definitions.Route{
				{
					Receiver: "not-test",
				},
				{
					Receiver: "test",
				},
			},
		},
	})
	require.True(t, result)
	result = isReceiverInUse("test", []*definitions.Route{
		{
			Receiver: "not-test",
			Routes: []*definitions.Route{
				{
					Receiver: "not-test",
				},
				{
					Receiver: "not-test",
				},
			},
		},
	})
	require.False(t, result)
}

func TestDeleteReceiver(t *testing.T) {
	testCases := []struct {
		name        string
		receiverUID string
		assert      func(t *testing.T, rev *ConfigRevision)
	}{
		{
			name:        "should remove receiver if exists",
			receiverUID: NameToUid("receiver1"),
			assert: func(t *testing.T, rev *ConfigRevision) {
				require.False(t, slices.ContainsFunc(rev.Config.AlertmanagerConfig.Receivers, func(receiver *definition.PostableApiReceiver) bool {
					return receiver.Name == "receiver1"
				}))
			},
		},
		{
			name:        "should do nothing if receiver does not exist",
			receiverUID: NameToUid("not-existing"),
			assert: func(t *testing.T, rev *ConfigRevision) {
				require.Equal(t, getConfigRevisionForTest(), rev)
			},
		},
		{
			name:        "should remove all receivers with the same name",
			receiverUID: NameToUid("dupe-receiver"),
			assert: func(t *testing.T, rev *ConfigRevision) {
				require.False(t, slices.ContainsFunc(rev.Config.AlertmanagerConfig.Receivers, func(receiver *definition.PostableApiReceiver) bool {
					return receiver.Name == "dupe-receiver"
				}))
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rev := getConfigRevisionForTest()
			rev.DeleteReceiver(tc.receiverUID)
			tc.assert(t, rev)
		})
	}
}

func TestCreateReceiver(t *testing.T) {
	rawCfg := notifytest.AllKnownV1ConfigsForTesting[webhook.Type]
	cfgSchema, _ := notify.GetSchemaVersionForIntegration(webhook.Type, schema.V1)
	settings := map[string]any{}
	require.NoError(t, json.Unmarshal([]byte(rawCfg.Config), &settings))

	testCases := []struct {
		name           string
		receiver       *models.Receiver
		expectedError  error
		assertResponse func(t *testing.T, rev *ConfigRevision, receiver *models.Receiver)
	}{
		{
			name: "should error if receiver already exists by UID",
			receiver: &models.Receiver{
				UID:  NameToUid("receiver1"),
				Name: "New receiver name",
			},
			expectedError: ErrReceiverExists,
		},
		{
			name: "should error if receiver already exists by name",
			receiver: &models.Receiver{
				UID:  "some-uid",
				Name: "receiver1",
			},
			expectedError: ErrReceiverInvalid,
		},
		{
			name: "should fail if integration UID is not valid",
			receiver: &models.Receiver{
				UID:  "some-uid",
				Name: "receiver",
				Integrations: []*models.Integration{
					{
						UID:      strings.Repeat("*", 256),
						Config:   cfgSchema,
						Settings: settings,
					},
				},
			},
			expectedError: ErrReceiverInvalid,
		},
		{
			name: "should fail if integration UID already exists",
			receiver: &models.Receiver{
				UID:  "some-uid",
				Name: "receiver",
				Integrations: []*models.Integration{
					{
						UID:      "integration-uid-1",
						Config:   cfgSchema,
						Settings: settings,
					},
				},
			},
			expectedError: ErrReceiverInvalid,
		},
		{
			name: "should add the receiver to configuration and set integrations UID",
			receiver: &models.Receiver{
				UID:        "some-uid",
				Name:       "receiver2",
				Provenance: "test",
				Integrations: []*models.Integration{
					{
						Config:   cfgSchema,
						Settings: settings,
					},
				},
			},
			expectedError: nil,
			assertResponse: func(t *testing.T, rev *ConfigRevision, receiver *models.Receiver) {
				t.Helper()
				idx := slices.IndexFunc(rev.Config.AlertmanagerConfig.Receivers, func(r *definition.PostableApiReceiver) bool {
					return r.Name == "receiver2"
				})
				assert.Greaterf(t, idx, -1, "receiver was not added to the configuration")
				postable := rev.Config.AlertmanagerConfig.Receivers[idx]
				require.Len(t, postable.GrafanaManagedReceivers, 1)
				require.Equal(t, receiver.Name, postable.Name)
				require.NotEmpty(t, postable.GrafanaManagedReceivers[0].UID)
				require.JSONEq(t, string(postable.GrafanaManagedReceivers[0].Settings), rawCfg.Config)

				assert.Equal(t, models.ResourceOriginGrafana, receiver.Origin)
				assert.Equal(t, NameToUid("receiver2"), receiver.UID)
				assert.Equal(t, postable.GrafanaManagedReceivers[0].UID, receiver.Integrations[0].UID)
				assert.EqualValues(t, "test", receiver.Provenance)
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rev := getConfigRevisionForTest()
			recv, err := rev.CreateReceiver(tc.receiver)
			if tc.expectedError != nil {
				require.ErrorIs(t, err, tc.expectedError)
				return
			}
			require.NoError(t, err)
			tc.assertResponse(t, rev, recv)
		})
	}
}

func TestUpdateReceiver(t *testing.T) {
	rawCfg := notifytest.AllKnownV1ConfigsForTesting[webhook.Type]
	cfgSchema, _ := notify.GetSchemaVersionForIntegration(webhook.Type, schema.V1)
	settings := map[string]any{}
	require.NoError(t, json.Unmarshal([]byte(rawCfg.Config), &settings))

	testCases := []struct {
		name           string
		receiver       *models.Receiver
		expectedError  error
		assertResponse func(t *testing.T, rev *ConfigRevision, receiver *models.Receiver)
	}{
		{
			name: "should error if receiver does not exists by UID",
			receiver: &models.Receiver{
				UID:  NameToUid("receiver2"),
				Name: "receiver1",
			},
			expectedError: ErrReceiverNotFound,
		},
		{
			name: "should fail if integration UID is not valid",
			receiver: &models.Receiver{
				UID:  NameToUid("receiver1"),
				Name: "receiver1",
				Integrations: []*models.Integration{
					{
						UID:      strings.Repeat("*", 256),
						Config:   cfgSchema,
						Settings: settings,
					},
				},
			},
			expectedError: ErrReceiverInvalid,
		},
		{
			name: "should fail if integration UID already exists",
			receiver: &models.Receiver{
				UID:  NameToUid("receiver1"),
				Name: "receiver1",
				Integrations: []*models.Integration{
					{
						UID:      "integration-uid-2",
						Config:   cfgSchema,
						Settings: settings,
					},
				},
			},
			expectedError: ErrReceiverInvalid,
		},
		{
			name: "should update the existing receiver",
			receiver: &models.Receiver{
				UID:        NameToUid("receiver1"),
				Name:       "receiver-new",
				Provenance: "test",
				Integrations: []*models.Integration{
					{
						Config:   cfgSchema,
						Settings: settings,
					},
				},
			},
			expectedError: nil,
			assertResponse: func(t *testing.T, rev *ConfigRevision, receiver *models.Receiver) {
				t.Helper()
				idx := slices.IndexFunc(rev.Config.AlertmanagerConfig.Receivers, func(r *definition.PostableApiReceiver) bool {
					return r.Name == "receiver-new"
				})
				assert.Greaterf(t, idx, -1, "receiver was not found to the configuration")
				old := getConfigRevisionForTest().Config.AlertmanagerConfig.Receivers[idx]
				require.Equalf(t, old.Name, "receiver1", "the receiver should be updated in place")

				postable := rev.Config.AlertmanagerConfig.Receivers[idx]
				require.Len(t, postable.GrafanaManagedReceivers, 1)
				require.Equal(t, receiver.Name, postable.Name)
				require.NotEmpty(t, postable.GrafanaManagedReceivers[0].UID)
				require.JSONEq(t, string(postable.GrafanaManagedReceivers[0].Settings), rawCfg.Config)

				assert.Equal(t, postable.GrafanaManagedReceivers[0].UID, receiver.Integrations[0].UID)
				assert.Equal(t, NameToUid("receiver-new"), receiver.UID)
				assert.EqualValues(t, "test", receiver.Provenance)
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rev := getConfigRevisionForTest()
			recv, err := rev.UpdateReceiver(tc.receiver)
			if tc.expectedError != nil {
				require.ErrorIs(t, err, tc.expectedError)
				return
			}
			require.NoError(t, err)
			tc.assertResponse(t, rev, recv)
		})
	}
}

func TestGetReceiver(t *testing.T) {
	rawCfg := notifytest.AllKnownV1ConfigsForTesting[webhook.Type]
	cfgSchema, _ := notify.GetSchemaVersionForIntegration(webhook.Type, schema.V1)
	settings := map[string]any{}
	require.NoError(t, json.Unmarshal([]byte(rawCfg.Config), &settings))

	t.Run("should return ErrReceiverNotFound if receiver does not exists", func(t *testing.T) {
		rev := getConfigRevisionForTest()
		_, err := rev.GetReceiver("not-found", nil)
		require.ErrorIs(t, err, ErrReceiverNotFound)
	})

	t.Run("should return receiver if exists", func(t *testing.T) {
		prov := provenances{
			"integration-uid-1": "test",
		}

		expected := &models.Receiver{
			UID:        NameToUid("receiver1"),
			Name:       "receiver1",
			Provenance: models.Provenance("test"),
			Origin:     models.ResourceOriginGrafana,
			Version:    "6e2fb0f572bc90f7",
			Integrations: []*models.Integration{
				{
					UID:            "integration-uid-1",
					Config:         cfgSchema,
					Settings:       settings,
					SecureSettings: make(map[string]string),
				},
			},
		}
		rev := getConfigRevisionForTest()
		result, err := rev.GetReceiver(NameToUid("receiver1"), prov)
		require.NoError(t, err)
		require.Equal(t, expected, result)
	})
}

func TestGetReceivers(t *testing.T) {
	rev := getConfigRevisionForTest()

	t.Run("should return all receivers with correct provenance", func(t *testing.T) {
		prov := provenances{
			"integration-uid-1": "test",
			"integration-uid-2": "some",
		}
		receivers, err := rev.GetReceivers(nil, prov)
		require.NoError(t, err)
		require.Len(t, receivers, len(rev.Config.AlertmanagerConfig.Receivers))
		for _, r := range receivers {
			assert.Equalf(t, NameToUid(r.Name), r.UID, "receiver UID should be function of receiver name")
			assert.Equal(t, r.Origin, models.ResourceOriginGrafana)
			if r.Name == "receiver1" {
				assert.EqualValues(t, "test", r.Provenance)
			} else if r.Name == "dupe-receiver" && r.Integrations[0].UID == "integration-uid-2" {
				assert.EqualValues(t, "some", r.Provenance)
			} else {
				assert.Empty(t, r.Provenance)
			}
		}
	})
	t.Run("should filter by uids", func(t *testing.T) {
		receivers, err := rev.GetReceivers([]string{"not-found-1", "not-found-2"}, nil)
		require.NoError(t, err)
		require.Empty(t, receivers)
		receivers, err = rev.GetReceivers([]string{NameToUid("receiver1")}, nil)
		require.NoError(t, err)
		require.Len(t, receivers, 1)
		expected, err := rev.GetReceiver(NameToUid("receiver1"), nil)
		require.NoError(t, err)
		require.Equal(t, expected, receivers[0])
	})
}

func TestReceiverNameUsedByRoutes(t *testing.T) {
	testCases := []struct {
		name           string
		receiverName   string
		expectedResult bool
	}{
		{
			name:           "should return true if receiver is used by routes",
			receiverName:   "receiver1",
			expectedResult: true,
		},
		{
			name:           "should return false if receiver is not used by routes",
			receiverName:   "receiver2",
			expectedResult: false,
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rev := getConfigRevisionForTest()
			result := rev.ReceiverNameUsedByRoutes(tc.receiverName)
			require.Equal(t, tc.expectedResult, result)
		})
	}
}

func TestReceiverUseByName(t *testing.T) {
	rev := getConfigRevisionForTest()
	rev.Config.AlertmanagerConfig.Route.Routes = append(rev.Config.AlertmanagerConfig.Route.Routes,
		&definitions.Route{
			Routes: []*definitions.Route{
				{
					Receiver: "receiver1",
				},
				{
					Receiver: "dupe-receiver",
				},
				{
					Receiver: "some-missing-receiver",
				},
			},
		})
	expected := map[string]int{
		"":                      1, // some routes do not have receiver set
		"receiver1":             2,
		"dupe-receiver":         1,
		"some-missing-receiver": 1,
	}
	require.Equal(t, expected, rev.ReceiverUseByName())
}

func TestRenameReceiverInRoutes(t *testing.T) {
	rev := getConfigRevisionForTest()
	rev.Config.AlertmanagerConfig.Route.Routes = append(rev.Config.AlertmanagerConfig.Route.Routes, &definitions.Route{
		Receiver: "receiver1",
		Routes: []*definitions.Route{
			{
				Receiver: "receiver1",
				Routes: []*definitions.Route{
					{
						Receiver: "missing-receiver",
					},
				},
			},
			{
				Receiver: "dupe-receiver",
				Routes: []*definitions.Route{
					{
						Receiver: "receiver1",
					},
				},
			},
		},
	})

	t.Run("should do nothing if receiver is not used by routes ", func(t *testing.T) {
		result := rev.RenameReceiverInRoutes("not-found", "found")
		require.Zero(t, result)
		expected := map[string]int{
			"receiver1":        4,
			"missing-receiver": 1,
			"dupe-receiver":    1,
		}
		require.Equal(t, expected, rev.ReceiverUseByName())
	})

	t.Run("should rename all references", func(t *testing.T) {
		result := rev.RenameReceiverInRoutes("receiver1", "found")
		require.Equal(t, result, 4)
		expected := map[string]int{
			"found":            4,
			"missing-receiver": 1,
			"dupe-receiver":    1,
		}
		require.Equal(t, expected, rev.ReceiverUseByName())
	})
}

func getConfigRevisionForTest() *ConfigRevision {
	return &ConfigRevision{
		Config: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "receiver1"},
				},
				Receivers: []*definition.PostableApiReceiver{
					{
						Receiver: config.Receiver{
							Name: "receiver1",
						},
						PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definition.PostableGrafanaReceiver{
								{
									UID:      "integration-uid-1",
									Type:     "webhook",
									Settings: definitions.RawMessage(notifytest.AllKnownV1ConfigsForTesting["webhook"].Config),
								},
							},
						},
					},
					{
						Receiver: config.Receiver{Name: "dupe-receiver"},
						PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definition.PostableGrafanaReceiver{
								{
									UID:      "integration-uid-2",
									Type:     "webhook",
									Settings: definitions.RawMessage(notifytest.AllKnownV1ConfigsForTesting["webhook"].Config),
								},
							},
						},
					},
					{
						Receiver: config.Receiver{Name: "dupe-receiver"},
						PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
							GrafanaManagedReceivers: []*definition.PostableGrafanaReceiver{
								{
									UID:      "integration-uid-3",
									Type:     "email",
									Settings: definitions.RawMessage(notifytest.AllKnownV1ConfigsForTesting["email"].Config),
								},
							},
						},
					},
				},
			},
		},
	}
}
