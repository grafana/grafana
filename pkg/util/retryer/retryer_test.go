package retryer

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMaxRetries(t *testing.T) {
	retryVal := 0

	err := Retry(func() (RetrySignal, error) {
		retryVal++
		return FuncFailure, nil
	}, 8, 100*time.Millisecond, 100*time.Millisecond)
	if err != nil {
		assert.FailNow(t, "Error while retrying function")
	}

	assert.Equal(t, 8, retryVal)
}
