package backgroundsvcs

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewBackgroundServiceRegistry(t *testing.T) {
	t.Run("should filter out nil", func(t *testing.T) {
		s := NewBackgroundServiceRegistry(nil)
		require.Len(t, s.GetServices(), 0)
	})
	t.Run("should filter out interfaces that hide nil", func(t *testing.T) {
		var srv *dummyService
		s := NewBackgroundServiceRegistry(srv)
		require.Len(t, s.GetServices(), 0)
	})
	t.Run("should register service", func(t *testing.T) {
		srv := &dummyService{}
		s := NewBackgroundServiceRegistry(srv)
		require.Len(t, s.GetServices(), 1)
	})
}

type dummyService struct {
}

func (d dummyService) Run(context.Context) error {
	return nil
}
