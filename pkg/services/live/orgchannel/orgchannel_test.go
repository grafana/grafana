package orgchannel

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStripK8sNamespace(t *testing.T) {
	channelID := "stream"
	_, _, err := StripK8sNamespace(channelID)
	require.Error(t, err)

	channelID = "plugin/testdata/random-20Hz-stream"
	_, _, err = StripK8sNamespace(channelID)
	require.Error(t, err)

	channelID = "org-123/plugin/testdata/random-20Hz-stream"
	ns, channel, err := StripK8sNamespace(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(123), ns.OrgID)
	require.Equal(t, "plugin/testdata/random-20Hz-stream", channel)
}

func TestPrependOrgID(t *testing.T) {
	channel := "plugin/testdata/random-20Hz-stream"
	channelID := PrependK8sNamespace("org-2", channel)
	require.Equal(t, "org-2/plugin/testdata/random-20Hz-stream", channelID)
}
