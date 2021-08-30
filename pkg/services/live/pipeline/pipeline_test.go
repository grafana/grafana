package pipeline

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHardcodedStorage(t *testing.T) {
	s2 := &hardcodedStorage{}
	rules, err := s2.ListChannelRules(context.Background(), ListLiveChannelRuleCommand{
		OrgId: 1,
	})
	require.NoError(t, err)
	require.True(t, len(rules) > 0)
}
