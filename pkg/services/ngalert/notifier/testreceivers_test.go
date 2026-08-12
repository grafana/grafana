package notifier

import (
	"context"
	"errors"
	"net/url"
	"testing"

	"github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/stretchr/testify/require"
)

func TestInvalidReceiverError_Error(t *testing.T) {
	e := alertingNotify.IntegrationValidationError{
		Integration: &models.IntegrationConfig{
			Name: "test",
			Type: "test-type",
			UID:  "uid",
		},
		Err: errors.New("this is an error"),
	}
	require.Equal(t, `failed to validate integration "test" (UID uid) of type "test-type": this is an error`, e.Error())
}

func TestReceiverTimeoutError_Error(t *testing.T) {
	e := alertingNotify.IntegrationTimeoutError{
		Integration: &models.IntegrationConfig{
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
		r := &models.IntegrationConfig{
			Name: "test",
			UID:  "uid",
		}
		require.Equal(t, alertingNotify.IntegrationTimeoutError{
			Integration: r,
			Err:         context.DeadlineExceeded,
		}, alertingNotify.ProcessIntegrationError(r, context.DeadlineExceeded))
	})

	t.Run("assert ReceiverTimeoutError is returned for *url.Error timeout", func(t *testing.T) {
		r := &models.IntegrationConfig{
			Name: "test",
			UID:  "uid",
		}
		urlError := &url.Error{
			Op:  "Get",
			URL: "https://grafana.net",
			Err: timeoutError{},
		}
		require.Equal(t, alertingNotify.IntegrationTimeoutError{
			Integration: r,
			Err:         urlError,
		}, alertingNotify.ProcessIntegrationError(r, urlError))
	})

	t.Run("assert unknown error is returned unmodified", func(t *testing.T) {
		r := &models.IntegrationConfig{
			Name: "test",
			UID:  "uid",
		}
		err := errors.New("this is an error")
		require.Equal(t, err, alertingNotify.ProcessIntegrationError(r, err))
	})
}
