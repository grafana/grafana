package validation_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/ngalert/api/validation"
)

func TestValidateInterval_SubsecondTruncation(t *testing.T) {
	baseInterval := 10 * time.Second

	t.Run("sub-second interval should fail validation", func(t *testing.T) {
		interval := 500 * time.Millisecond
		sec, err := validation.ValidateInterval(interval, baseInterval)
		require.Error(t, err, "sub-second interval must fail validation")
		require.NotEqual(t, int64(0), sec, "should not return 0-second interval")
	})

	t.Run("fractional interval should fail validation", func(t *testing.T) {
		interval := 10500 * time.Millisecond // 10.5 seconds
		_, err := validation.ValidateInterval(interval, baseInterval)
		require.Error(t, err, "non-multiple fractional interval must fail validation")
	})

	t.Run("exact multiple of base interval succeeds", func(t *testing.T) {
		interval := 20 * time.Second
		sec, err := validation.ValidateInterval(interval, baseInterval)
		require.NoError(t, err)
		require.Equal(t, int64(20), sec)
	})

	t.Run("zero base interval should return error without panic", func(t *testing.T) {
		interval := 10 * time.Second
		_, err := validation.ValidateInterval(interval, 0)
		require.Error(t, err)
	})
}
