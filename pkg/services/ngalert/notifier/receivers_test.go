package notifier

import (
	"context"
	"errors"
	"net/url"
	"testing"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/require"
)

func TestInvalidReceiverError_Error(t *testing.T) {
	e := alertingNotify.InvalidReceiverError{
		Receiver: &alertingNotify.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		},
		Err: errors.New("this is an error"),
	}
	require.Equal(t, "the receiver is invalid: this is an error", e.Error())
}

func TestReceiverTimeoutError_Error(t *testing.T) {
	e := alertingNotify.ReceiverTimeoutError{
		Receiver: &alertingNotify.GrafanaReceiver{
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
		r := &alertingNotify.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		}
		require.Equal(t, alertingNotify.ReceiverTimeoutError{
			Receiver: r,
			Err:      context.DeadlineExceeded,
		}, alertingNotify.ProcessNotifierError(r, context.DeadlineExceeded))
	})

	t.Run("assert ReceiverTimeoutError is returned for *url.Error timeout", func(t *testing.T) {
		r := &alertingNotify.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		}
		urlError := &url.Error{
			Op:  "Get",
			URL: "https://grafana.net",
			Err: timeoutError{},
		}
		require.Equal(t, alertingNotify.ReceiverTimeoutError{
			Receiver: r,
			Err:      urlError,
		}, alertingNotify.ProcessNotifierError(r, urlError))
	})

	t.Run("assert unknown error is returned unmodified", func(t *testing.T) {
		r := &alertingNotify.GrafanaReceiver{
			Name: "test",
			UID:  "uid",
		}
		err := errors.New("this is an error")
		require.Equal(t, err, alertingNotify.ProcessNotifierError(r, err))
	})
}
