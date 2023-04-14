package httpclient

import (
	"errors"
	"fmt"
	"io"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMaxBytesReader(t *testing.T) {
	tcs := []struct {
		limit      int64
		bodyLength int
		body       string
		err        error
	}{
		{limit: 1, bodyLength: 1, body: "d", err: errors.New("error: http: response body too large, response limit is set to: 1")},
		{limit: 1000000, bodyLength: 5, body: "dummy", err: nil},
		{limit: 0, bodyLength: 0, body: "", err: errors.New("error: http: response body too large, response limit is set to: 0")},
	}
	for _, tc := range tcs {
		t.Run(fmt.Sprintf("Test MaxBytesReader with limit: %d", tc.limit), func(t *testing.T) {
			body := io.NopCloser(strings.NewReader("dummy"))
			readCloser := MaxBytesReader(body, tc.limit)

			bodyBytes, err := io.ReadAll(readCloser)
			if err != nil {
				require.EqualError(t, tc.err, err.Error())
			} else {
				require.NoError(t, tc.err)
			}

			require.Len(t, bodyBytes, tc.bodyLength)
			require.Equal(t, string(bodyBytes), tc.body)
		})
	}
}
