package channelrule

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

type testStorage struct{}

func (t testStorage) ListChannelRules(_ context.Context, cmd models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error) {
	if cmd.OrgId == 1 {
		return []*models.LiveChannelRule{
			{
				OrgId:   1,
				Pattern: "stream/telegraf/*",
				Settings: models.LiveChannelRuleSettings{
					RemoteWrite: &models.RemoteWriteConfig{
						Endpoint:           "test_endpoint",
						User:               "test_user",
						SampleMilliseconds: 1000,
					},
				},
				SecureSettings: securejsondata.GetEncryptedJsonData(map[string]string{
					"remoteWritePassword": "test_password",
				}),
			},
			{
				OrgId:   1,
				Pattern: "stream/telegraf*",
				Settings: models.LiveChannelRuleSettings{
					RemoteWrite: &models.RemoteWriteConfig{
						Endpoint:           "test_endpoint_2",
						User:               "test_user_2",
						SampleMilliseconds: 2000,
					},
				},
				SecureSettings: securejsondata.GetEncryptedJsonData(map[string]string{
					"remoteWritePassword": "test_password",
				}),
			},
			{
				OrgId:   1,
				Pattern: "stream/*/cpu/test",
				Settings: models.LiveChannelRuleSettings{
					RemoteWrite: &models.RemoteWriteConfig{
						Endpoint:           "test_endpoint",
						User:               "test_user",
						SampleMilliseconds: 1000,
					},
				},
				SecureSettings: securejsondata.GetEncryptedJsonData(map[string]string{
					"remoteWritePassword": "test_password",
				}),
			},
		}, nil
	} else if cmd.OrgId == 2 {
		return []*models.LiveChannelRule{
			{
				OrgId:   2,
				Pattern: "stream/*/cpu",
				Settings: models.LiveChannelRuleSettings{
					RemoteWrite: &models.RemoteWriteConfig{
						Endpoint:           "test_endpoint",
						User:               "test_user",
						SampleMilliseconds: 1000, // Write no frequently than once in a second.
					},
				},
				SecureSettings: securejsondata.GetEncryptedJsonData(map[string]string{
					"remoteWritePassword": "test_password",
				}),
			},
		}, nil
	}
	return nil, errors.New("boom")
}

func TestStorage_Get(t *testing.T) {
	s := NewCache(&testStorage{})
	c, ok, err := s.Get(1, "stream/telegraf/cpu") // stream/telegraf/* should win
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), c.OrgId)
	require.Equal(t, int64(1000), c.Settings.RemoteWrite.SampleMilliseconds)

	c, ok, err = s.Get(1, "stream/telegraf/cpu/test") // stream/telegraf/* should win
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), c.OrgId)
	require.Equal(t, int64(1000), c.Settings.RemoteWrite.SampleMilliseconds)

	_, ok, err = s.Get(1, "streams/telegraf/cpu")
	require.NoError(t, err)
	require.False(t, ok)

	c, ok, err = s.Get(2, "stream/any/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(2), c.OrgId)

	_, _, err = s.Get(3, "stream/any/cpu")
	require.Error(t, err)
}

func BenchmarkGet(b *testing.B) {
	s := NewCache(&testStorage{})
	for i := 0; i < b.N; i++ {
		_, ok, err := s.Get(1, "stream/telegraf/cpu")
		if err != nil || !ok {
			b.Fatal("unexpected return values")
		}
	}
}
