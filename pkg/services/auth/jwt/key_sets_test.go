package jwt

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestGetCacheExpiration(t *testing.T) {
	ks := &keySetHTTP{cacheExpiration: 10 * time.Minute}
	type testCase struct {
		name       string
		header     string
		expiration time.Duration
	}

	testCases := []testCase{
		{
			name:       "no cache control header",
			header:     "",
			expiration: 10 * time.Minute,
		},
		{
			name:       "max-age less than cache duration",
			header:     "max-age=300",
			expiration: 5 * time.Minute,
		},
		{
			name:       "max-age greater than cache duration",
			header:     "max-age=7200",
			expiration: 10 * time.Minute,
		},
		{
			name:       "invalid max-age",
			header:     "max-age=invalid",
			expiration: 10 * time.Minute,
		},
		{
			name:       "multiple cache control directives",
			header:     "max-age=300, no-cache",
			expiration: 5 * time.Minute,
		},
	}

	for _, tc := range testCases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			expiration := ks.getCacheExpiration(tc.header)
			assert.Equal(t, tc.expiration, expiration)
		})
	}
}
