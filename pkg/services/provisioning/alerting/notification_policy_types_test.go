package alerting

import (
	"os"
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

func TestNotificationPolicy(t *testing.T) {
	const (
		envKey   = "NOTIFIER_EMAIL_REMINDER_FREQUENCY"
		envValue = "4h"
	)
	err := os.Setenv(envKey, envValue)
	require.NoError(t, err)
	defer func() {
		_ = os.Unsetenv(envKey)
	}()
	data := `orgId: 123
receiver: test
continue: true
repeat_interval: ${NOTIFIER_EMAIL_REMINDER_FREQUENCY}
`
	var model NotificiationPolicyV1

	err = yaml.Unmarshal([]byte(data), &model)
	require.NoError(t, err)
	np, err := model.mapToModel()
	require.NoError(t, err)
	require.Equal(t, int64(123), np.OrgID)
	require.Equal(t, "test", np.Policy.Receiver)
	require.True(t, np.Policy.Continue)
	require.Equal(t, envValue, np.Policy.RepeatInterval.String())
}
