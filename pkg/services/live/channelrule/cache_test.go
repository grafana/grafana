package channelrule

import (
	"testing"

	"github.com/grafana/grafana/pkg/components/securejsondata"
	"github.com/grafana/grafana/pkg/models"

	"github.com/stretchr/testify/require"
)

type testStorage struct{}

func (t testStorage) ListChannelRules(_ models.ListLiveChannelRuleCommand) ([]*models.LiveChannelRule, error) {
	return []*models.LiveChannelRule{
		{
			OrgId:   1,
			Pattern: "stream/telegraf/*",
			Config: models.LiveChannelRulePlainConfig{
				RemoteWriteEndpoint:           "test_endpoint",
				RemoteWriteUser:               "test_user",
				RemoteWriteSampleMilliseconds: 1000, // Write no frequently than once in a second.
			},
			Secure: securejsondata.GetEncryptedJsonData(map[string]string{
				"remoteWritePassword": "test_password",
			}),
		},
		{
			OrgId:   2,
			Pattern: "stream/*/cpu",
			Config: models.LiveChannelRulePlainConfig{
				RemoteWriteEndpoint:           "test_endpoint",
				RemoteWriteUser:               "test_user",
				RemoteWriteSampleMilliseconds: 1000, // Write no frequently than once in a second.
			},
			Secure: securejsondata.GetEncryptedJsonData(map[string]string{
				"remoteWritePassword": "test_password",
			}),
		},
	}, nil
}

func TestStorage_Get(t *testing.T) {
	s := NewCache(&testStorage{})
	c, ok, err := s.Get(1, "stream/telegraf/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), c.OrgId)

	_, ok, err = s.Get(1, "streams/telegraf/cpu")
	require.NoError(t, err)
	require.False(t, ok)

	c, ok, err = s.Get(2, "stream/any/cpu")
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(2), c.OrgId)
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
