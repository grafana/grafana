package ualert

import (
	"fmt"
	"math/rand"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/sqlstore/migrator"
	"github.com/grafana/grafana/pkg/util"
)

func Test_makeReceiverAndRoute(t *testing.T) {
	emptyMigration := func() *migration {
		return &migration{
			mg: &migrator.Migrator{
				Logger: log.New("test"),
			},
			migratedChannelsPerOrg:    make(map[int64]map[*notificationChannel]struct{}),
			portedChannelGroupsPerOrg: make(map[int64]map[string]string),
			seenChannelUIDs:           make(map[string]struct{}),
		}
	}

	generateChannel := func(channelType string, settings map[string]interface{}, secureSettings map[string]string) *notificationChannel {
		uid := util.GenerateShortUID()
		return &notificationChannel{
			ID:                    rand.Int63(),
			OrgID:                 rand.Int63(),
			Uid:                   uid,
			Name:                  fmt.Sprintf("Test-%s", uid),
			Type:                  channelType,
			DisableResolveMessage: rand.Int63()%2 == 0,
			IsDefault:             rand.Int63()%2 == 0,
			Settings:              simplejson.NewFromAny(settings),
			SecureSettings:        GetEncryptedJsonData(secureSettings),
		}
	}

	t.Run("Slack channel is migrated", func(t *testing.T) {
		t.Run("url is removed if it is invalid (secure settings)", func(t *testing.T) {
			secureSettings := map[string]string{
				"url":   invalidUri,
				"token": util.GenerateShortUID(),
			}
			settings := map[string]interface{}{
				"test": "data",
				"some_map": map[string]interface{}{
					"test": rand.Int63(),
				},
			}

			channel := generateChannel("slack", settings, secureSettings)
			channelsUid := []interface{}{
				channel.Uid,
			}
			defaultChannels := make([]*notificationChannel, 0)
			allChannels := map[interface{}]*notificationChannel{
				channel.Uid: channel,
			}

			apiReceiver, _, err := emptyMigration().makeReceiverAndRoute(util.GenerateShortUID(), channel.OrgID, channelsUid, defaultChannels, allChannels)
			require.NoError(t, err)

			require.Len(t, apiReceiver.GrafanaManagedReceivers, 1)

			receiver := apiReceiver.GrafanaManagedReceivers[0]

			require.NotContains(t, receiver.SecureSettings, "url")
			require.Contains(t, receiver.SecureSettings, "token")
			require.Equal(t, secureSettings["token"], receiver.SecureSettings["token"])
			actualSettings, err := receiver.Settings.Map()
			require.NoError(t, err)
			require.Equal(t, settings, actualSettings)
		})

		t.Run("url is removed if it is invalid (settings)", func(t *testing.T) {
			secureSettings := map[string]string{
				"token": util.GenerateShortUID(),
			}
			settings := map[string]interface{}{
				"url":  invalidUri,
				"test": "data",
				"some_map": map[string]interface{}{
					"test": rand.Int63(),
				},
			}

			channel := generateChannel("slack", settings, secureSettings)
			channelsUid := []interface{}{
				channel.Uid,
			}
			defaultChannels := make([]*notificationChannel, 0)
			allChannels := map[interface{}]*notificationChannel{
				channel.Uid: channel,
			}

			apiReceiver, _, err := emptyMigration().makeReceiverAndRoute(util.GenerateShortUID(), channel.OrgID, channelsUid, defaultChannels, allChannels)
			require.NoError(t, err)

			require.Len(t, apiReceiver.GrafanaManagedReceivers, 1)

			receiver := apiReceiver.GrafanaManagedReceivers[0]

			require.NotContains(t, receiver.SecureSettings, "url")
			require.Contains(t, receiver.SecureSettings, "token")
			require.Equal(t, secureSettings["token"], receiver.SecureSettings["token"])
			actualSettings, err := receiver.Settings.Map()
			require.NoError(t, err)
			delete(settings, "url")
			require.Equal(t, settings, actualSettings)
		})
	})
}

const invalidUri = "�6�M��)uk譹1(�h`$�o�N>mĕ����cS2�dh![ę�	���`csB�!��OSxP�{�"
