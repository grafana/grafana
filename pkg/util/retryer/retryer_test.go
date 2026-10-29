package retryer

import (
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMaxRetries(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		retryVal := 0

		err := Retry(func() (RetrySignal, error) {
			retryVal++
			return FuncFailure, nil
		}, 8, 100*time.Millisecond, 100*time.Millisecond)
		assert.Error(t, err) // Exceeding max-retries is an error.

		assert.Equal(t, 8, retryVal)
	})
}
