package lokihttp

import (
	"errors"
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestSendErrorCause(t *testing.T) {
	t.Run("nil error stays nil", func(t *testing.T) {
		require.NoError(t, sendErrorCause(nil))
	})

	t.Run("non-url error is returned as is", func(t *testing.T) {
		err := errors.New("server returned HTTP status 429 Too Many Requests (429): rate limited")
		require.Equal(t, err, sendErrorCause(err))
	})

	t.Run("drops the request url from a transport error", func(t *testing.T) {
		err := &url.Error{
			Op:  "Post",
			URL: "https://12345:token@logs.example.net/loki/api/v1/push",
			Err: errors.New("dial tcp: no such host"),
		}
		cause := sendErrorCause(err)
		require.EqualError(t, cause, "dial tcp: no such host")
	})

	t.Run("drops the request url from a request build error", func(t *testing.T) {
		_, err := http.NewRequest("POST", "https://12345:token@logs.example.net/loki/api/v1/push\x7f", nil)
		require.Error(t, err)

		cause := sendErrorCause(err)
		require.Error(t, cause)
		require.NotContains(t, cause.Error(), "logs.example.net")
	})

	t.Run("unwraps a wrapped url error", func(t *testing.T) {
		inner := &url.Error{
			Op:  "Post",
			URL: "https://logs.example.net/loki/api/v1/push",
			Err: errors.New("context deadline exceeded"),
		}
		cause := sendErrorCause(errors.Join(inner))
		require.EqualError(t, cause, "context deadline exceeded")
	})
}
