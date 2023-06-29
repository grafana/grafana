package angulardetectorsprovider

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDynamicUpdater(t *testing.T) {
	t.Run("returns nil", func(t *testing.T) {
		svc := noOpDynamicUpdater{}
		err := svc.Run(context.Background())
		require.NoError(t, err)
	})
}
