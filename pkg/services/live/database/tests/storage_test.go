package tests

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/live/model"
	"github.com/grafana/grafana/pkg/tests/testsuite"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationLiveMessage(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	storage := SetupTestStorage(t)

	getQuery := &model.GetLiveMessageQuery{
		OrgID:   1,
		Channel: "test_channel",
	}
	_, ok, err := storage.GetLiveMessage(getQuery)
	require.NoError(t, err)
	require.False(t, ok)

	saveQuery := &model.SaveLiveMessageQuery{
		OrgID:   1,
		Channel: "test_channel",
		Data:    []byte(`{}`),
	}
	err = storage.SaveLiveMessage(saveQuery)
	require.NoError(t, err)

	msg, ok, err := storage.GetLiveMessage(getQuery)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), msg.OrgID)
	require.Equal(t, "test_channel", msg.Channel)
	require.Equal(t, json.RawMessage(`{}`), msg.Data)
	require.NotZero(t, msg.Published)

	// try saving again, should be replaced.
	saveQuery2 := &model.SaveLiveMessageQuery{
		OrgID:   1,
		Channel: "test_channel",
		Data:    []byte(`{"input": "hello"}`),
	}
	err = storage.SaveLiveMessage(saveQuery2)
	require.NoError(t, err)

	getQuery2 := &model.GetLiveMessageQuery{
		OrgID:   1,
		Channel: "test_channel",
	}
	msg2, ok, err := storage.GetLiveMessage(getQuery2)
	require.NoError(t, err)
	require.True(t, ok)
	require.Equal(t, int64(1), msg2.OrgID)
	require.Equal(t, "test_channel", msg2.Channel)
	require.Equal(t, json.RawMessage(`{"input": "hello"}`), msg2.Data)
	require.NotZero(t, msg2.Published)
}
