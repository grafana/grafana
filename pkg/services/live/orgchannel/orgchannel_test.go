package orgchannel

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStripOrgID(t *testing.T) {
	channelID := "stream"
	_, _, err := StripOrgID(channelID)
	require.Error(t, err)

	channelID = "plugin/testdata/random-20Hz-stream"
	_, _, err = StripOrgID(channelID)
	require.Error(t, err)

	channelID = "1/plugin/testdata/random-20Hz-stream"
	orgID, channel, err := StripOrgID(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(1), orgID)
	require.Equal(t, "plugin/testdata/random-20Hz-stream", channel)
}

func TestPrependOrgID(t *testing.T) {
	channel := "plugin/testdata/random-20Hz-stream"
	channelID := PrependOrgID(2, channel)
	require.Equal(t, "2/plugin/testdata/random-20Hz-stream", channelID)
}
