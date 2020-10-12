package util

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestMaxRetries(t *testing.T) {
	retryVal := 0

	Retry(func() (RetrySignal, error) {
		retryVal++
		return Failure, nil
	}, 8, 100*time.Millisecond, 100*time.Millisecond)

	assert.Equal(t, 8, retryVal)
}
