package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFileStorage(t *testing.T) {
	s := &fileStorage{}
	rules, err := s.ListChannelRules(context.Background(), ListLiveChannelRuleCommand{
		OrgId: 1,
	})
	require.NoError(t, err)
	require.True(t, len(rules) > 0)
	s2 := &hardcodedStorage{}
	rules, err = s2.ListChannelRules(context.Background(), ListLiveChannelRuleCommand{
		OrgId: 1,
	})
	require.NoError(t, err)
	require.True(t, len(rules) > 0)
}
