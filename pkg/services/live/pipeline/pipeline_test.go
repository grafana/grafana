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
	require.Len(t, rules, 10)
}
