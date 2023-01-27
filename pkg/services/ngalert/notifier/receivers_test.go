package notifier

import (
	"context"
	"errors"
	"net/url"
	"testing"

	"github.com/grafana/alerting/alerting"

	"github.com/stretchr/testify/require"
)

func TestInvalidReceiverError_Error(t *testing.T) {
	e := alerting.InvalidReceiverError{
		Receiver: &alerting.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		},
		Err: errors.New("this is an error"),
	}
	require.Equal(t, "the receiver is invalid: this is an error", e.Error())
}

func TestReceiverTimeoutError_Error(t *testing.T) {
	e := alerting.ReceiverTimeoutError{
		Receiver: &alerting.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		},
		Err: errors.New("context deadline exceeded"),
	}
	require.Equal(t, "the receiver timed out: context deadline exceeded", e.Error())
}

type timeoutError struct{}

func (e timeoutError) Error() string {
	return "the request timed out"
}

func (e timeoutError) Timeout() bool {
	return true
}

func TestProcessNotifierError(t *testing.T) {
	t.Run("assert ReceiverTimeoutError is returned for context deadline exceeded", func(t *testing.T) {
		r := &alerting.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		}
		require.Equal(t, alerting.ReceiverTimeoutError{
			Receiver: r,
			Err:      context.DeadlineExceeded,
		}, alerting.ProcessNotifierError(r, context.DeadlineExceeded))
	})

	t.Run("assert ReceiverTimeoutError is returned for *url.Error timeout", func(t *testing.T) {
		r := &alerting.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		}
		urlError := &url.Error{
			Op:  "Get",
			URL: "https://grafana.net",
			Err: timeoutError{},
		}
		require.Equal(t, alerting.ReceiverTimeoutError{
			Receiver: r,
			Err:      urlError,
		}, alerting.ProcessNotifierError(r, urlError))
	})

	t.Run("assert unknown error is returned unmodified", func(t *testing.T) {
		r := &alerting.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		}
		err := errors.New("this is an error")
		require.Equal(t, err, alerting.ProcessNotifierError(r, err))
	})
}
