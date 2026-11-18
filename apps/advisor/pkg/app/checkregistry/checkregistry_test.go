package checkregistry

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

func TestService_Check(t *testing.T) {
	s := &Service{cfg: setting.NewCfg()}

	for _, id := range checkIDs {
		c, ok := s.Check(id)
		require.True(t, ok, id)
		assert.Equal(t, id, c.ID())
	}
	assert.Len(t, s.Checks(), len(checkIDs))

	_, ok := s.Check("unknown")
	assert.False(t, ok)
}
