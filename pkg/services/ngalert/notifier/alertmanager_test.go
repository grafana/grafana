package notifier

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAlertmanager(t *testing.T) {
	t.SkipNow()
	am := &Alertmanager{}
	require.NoError(t, am.Init())
}
