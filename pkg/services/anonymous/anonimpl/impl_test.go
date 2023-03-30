package anonimpl

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
)

func TestAnonSessionKey(t *testing.T) {
	testCases := []struct {
		name     string
		session  *AnonSession
		expected string
	}{
		{
			name: "should hash correctly",
			session: &AnonSession{
				ip:        "10.10.10.10",
				userAgent: "test",
			},
			expected: "anon-session:ad9f5c6bf504a9fa77c37a3a6658c0cd",
		},
		{
			name: "should hash correctly with different ip",
			session: &AnonSession{
				ip:        "10.10.10.1",
				userAgent: "test",
			},
			expected: "anon-session:580605320245e8289e0b301074a027c3",
		},
		{
			name: "should hash correctly with different user agent",
			session: &AnonSession{
				ip:        "10.10.10.1",
				userAgent: "test2",
			},
			expected: "anon-session:5fdd04b0bd04a9fa77c4243f8111258b",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.session.Key()
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)

			// ensure that the key is the same
			got, err = tc.session.Key()
			require.NoError(t, err)
			assert.Equal(t, tc.expected, got)
		})
	}
}

func TestIntegrationAnonSessionService_tag(t *testing.T) {
	testCases := []struct {
		name          string
		req           []*http.Request
		expectedCount int64
	}{
		{
			name:          "no requests",
			req:           []*http.Request{},
			expectedCount: 0,
		},
		{
			name: "missing info should not tag",
			req: []*http.Request{
				{
					Header: http.Header{
						"User-Agent": []string{"test"},
					},
				},
			},
			expectedCount: 0,
		},
		{
			name: "should tag once",
			req: []*http.Request{
				{
					Header: http.Header{
						"User-Agent":      []string{"test"},
						"X-Forwarded-For": []string{"10.30.30.1"},
					},
				},
			},
			expectedCount: 1,
		},
		{
			name: "repeat request should not tag",
			req: []*http.Request{
				{
					Header: http.Header{
						"User-Agent":      []string{"test"},
						"X-Forwarded-For": []string{"10.30.30.1"},
					},
				},
				{
					Header: http.Header{
						"User-Agent":      []string{"test"},
						"X-Forwarded-For": []string{"10.30.30.1"},
					},
				},
			},
			expectedCount: 1,
		},
		{
			name: "tag 2 different requests",
			req: []*http.Request{
				{
					Header: http.Header{
						"User-Agent":      []string{"test"},
						"X-Forwarded-For": []string{"10.30.30.1"},
					},
				},
				{
					Header: http.Header{
						"User-Agent":      []string{"test"},
						"X-Forwarded-For": []string{"10.30.30.2"},
					},
				},
			},
			expectedCount: 2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeStore := remotecache.NewFakeStore(t)

			anonService := ProvideAnonymousSessionService(fakeStore, &usagestats.UsageStatsMock{})

			for _, req := range tc.req {
				err := anonService.TagSession(context.Background(), req)
				require.NoError(t, err)
			}

			stats, err := anonService.usageStatFn(context.Background())
			require.NoError(t, err)

			assert.Equal(t, tc.expectedCount, stats["stats.anonymous.session.count"].(int64))
		})
	}
}

// Ensure that the local cache prevents request from being tagged
func TestIntegrationAnonSessionService_localCacheSafety(t *testing.T) {
	fakeStore := remotecache.NewFakeStore(t)
	anonService := ProvideAnonymousSessionService(fakeStore, &usagestats.UsageStatsMock{})

	req := &http.Request{
		Header: http.Header{
			"User-Agent":      []string{"test"},
			"X-Forwarded-For": []string{"10.30.30.2"},
		},
	}

	anonSession := &AnonSession{
		ip:        "10.30.30.2",
		userAgent: "test",
	}

	key, err := anonSession.Key()
	require.NoError(t, err)

	anonService.localCache.SetDefault(key, true)

	err = anonService.TagSession(context.Background(), req)
	require.NoError(t, err)

	stats, err := anonService.usageStatFn(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(0), stats["stats.anonymous.session.count"].(int64))
}
