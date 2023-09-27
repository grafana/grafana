package backgroundsvcs

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBackgroundServiceRegistry_GetServices(t *testing.T) {
	s := NewBackgroundServiceRegistry(newTestService("A", nil, false), newTestService("B", errors.New("boom"), false))
	require.Len(t, s.GetServices(), 2)
}
