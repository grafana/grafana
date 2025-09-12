package legacy_storage

import (
	"slices"
	"testing"

	"github.com/grafana/alerting/definition"
	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/pkg/labels"
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
	rev := &ConfigRevision{
		Config: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "receiver2"},
				},
				Receivers: []*definition.PostableApiReceiver{
					{
						Receiver: config.Receiver{Name: "receiver1"},
					},
					{
						Receiver: config.Receiver{Name: "receiver2"},
					},
					{
						Receiver: config.Receiver{Name: "dupe-receiver"},
					},
					{
						Receiver: config.Receiver{Name: "dupe-receiver"},
					},
				},
			},
			ExtraConfigs: []definitions.ExtraConfiguration{
				{
					Identifier:         "test-config",
					MergeMatchers:      config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
					AlertmanagerConfig: `{"route":{"receiver":"staged-default"},"receivers":[{"name":"staged-default"}]}`,
				},
			},
		},
	}

	t.Run("should remove receiver if exists", func(t *testing.T) {
		rev.DeleteReceiver(NameToUid("receiver1"))
		require.False(t, slices.ContainsFunc(rev.Config.AlertmanagerConfig.Receivers, func(receiver *definition.PostableApiReceiver) bool {
			return receiver.Name == "receiver1"
		}))
	})
	t.Run("should do nothing if receiver does not exist", func(t *testing.T) {
		rev.DeleteReceiver(NameToUid("receiver1"))
	})
	require.NoError(t, rev.IncludeStaged())
	t.Run("should reset staged config", func(t *testing.T) {
		rev.DeleteReceiver(NameToUid("receiver2"))
		require.Nil(t, rev.readConfig)
	})
	require.NoError(t, rev.IncludeStaged())
	t.Run("should do nothing if receiver in staged", func(t *testing.T) {
		rev.DeleteReceiver(NameToUid("staged-default"))
		require.NoError(t, rev.IncludeStaged())
		require.True(t, slices.ContainsFunc(rev.readConfig.Receivers, func(receiver *definition.PostableApiReceiver) bool {
			return receiver.Name == "staged-default"
		}))
	})
	t.Run("should remove all receivers with the same name", func(t *testing.T) {
		rev.DeleteReceiver(NameToUid("dupe-receiver"))
		require.False(t, slices.ContainsFunc(rev.Config.AlertmanagerConfig.Receivers, func(receiver *definition.PostableApiReceiver) bool {
			return receiver.Name == "dupe-receiver"
		}))
	})
}

func TestCreateReceiver(t *testing.T) {
	rev := &ConfigRevision{
		Config: &definitions.PostableUserConfig{
			AlertmanagerConfig: definitions.PostableApiAlertingConfig{
				Config: definitions.Config{
					Route: &definitions.Route{Receiver: "receiver2"},
				},
				Receivers: []*definition.PostableApiReceiver{
					{
						Receiver: config.Receiver{Name: "receiver1"},
					},
				},
			},
			ExtraConfigs: []definitions.ExtraConfiguration{
				{
					Identifier:         "test-config",
					MergeMatchers:      config.Matchers{{Type: labels.MatchEqual, Name: "env", Value: "prod"}},
					AlertmanagerConfig: `{"route":{"receiver":"staged-default"},"receivers":[{"name":"staged-default"}]}`,
				},
			},
		},
	}

	t.Run("should error if receiver already exists by UID", func(t *testing.T) {
		_, err := rev.CreateReceiver(&models.Receiver{
			UID:  NameToUid("receiver1"),
			Name: "New receiver name",
		})
		require.ErrorIs(t, err, ErrReceiverExists)
	})

	t.Run("should error if receiver already exists by name", func(t *testing.T) {
		_, err := rev.CreateReceiver(&models.Receiver{
			UID:  "some-uid",
			Name: "receiver1",
		})
		require.ErrorIs(t, err, ErrReceiverInvalid)
	})
}
