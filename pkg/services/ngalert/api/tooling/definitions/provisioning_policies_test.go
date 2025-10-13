package definitions

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestNotificationPolicyExportMarshal(t *testing.T) {
	c := true
	npe := &NotificationPolicyExport{
		OrgID: 1,
		RouteExport: &RouteExport{
			Receiver: "receiver",
			Continue: &c,
		},
	}
	t.Run("json", func(t *testing.T) {
		val, err := json.Marshal(npe)
		require.NoError(t, err)
		require.Equal(t, "{\"orgId\":1,\"receiver\":\"receiver\",\"continue\":true}", string(val))
	})
	t.Run("yaml", func(t *testing.T) {
		val, err := yaml.Marshal(npe)
		require.NoError(t, err)
		require.Equal(t, "orgId: 1\nreceiver: receiver\ncontinue: true\n", string(val))
	})
}
