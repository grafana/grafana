package api

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestParseEnvelope(t *testing.T) {
	payload := `{"event_id":"0123456789abcdef0123456789abcdef","message":"boom"}`
	body := []byte(fmt.Sprintf("{}\n{\"type\":\"event\",\"length\":%d}\n%s\n", len(payload), payload))
	event, err := parseEnvelope(body)
	require.NoError(t, err)
	require.Equal(t, "0123456789abcdef0123456789abcdef", event.EventID)
	require.Equal(t, "boom", event.Message)
}

func TestParseEnvelopeRejectsShortPayload(t *testing.T) {
	_, err := parseEnvelope([]byte("{}\n{\"type\":\"event\",\"length\":5}\n{}\n"))
	require.Error(t, err)
}

func TestParseEnvelopeRejectsMissingLengthSeparator(t *testing.T) {
	_, err := parseEnvelope([]byte("{}\n{\"type\":\"event\",\"length\":2}\n{}x"))
	require.Error(t, err)
}

func TestSentryAuthKeyRequiresSentryHeader(t *testing.T) {
	require.Equal(t, "demo-key", sentryAuthKey("Sentry sentry_version=7,sentry_key=demo-key"))
	require.Empty(t, sentryAuthKey("demo-key"))
}
