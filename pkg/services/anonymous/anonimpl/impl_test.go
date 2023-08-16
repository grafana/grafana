package anonimpl

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/anonymous"
)

func TestAnonDeviceKey(t *testing.T) {
	testCases := []struct {
		name     string
		session  *Device
		expected string
	}{
		{
			name: "should hash correctly",
			session: &Device{
				Kind:      anonymous.AnonDevice,
				IP:        "10.10.10.10",
				UserAgent: "test",
			},
			expected: "anon-session:ad9f5c6bf504a9fa77c37a3a6658c0cd",
		},
		{
			name: "should hash correctly with different ip",
			session: &Device{
				Kind:      anonymous.AnonDevice,
				IP:        "10.10.10.1",
				UserAgent: "test",
			},
			expected: "anon-session:580605320245e8289e0b301074a027c3",
		},
		{
			name: "should hash correctly with different user agent",
			session: &Device{
				Kind:      anonymous.AnonDevice,
				IP:        "10.10.10.1",
				UserAgent: "test2",
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

func TestIntegrationDeviceService_tag(t *testing.T) {
	type tagReq struct {
		httpReq *http.Request
		kind    anonymous.DeviceKind
	}
	testCases := []struct {
		name                string
		req                 []tagReq
		expectedAnonCount   int64
		expectedAuthedCount int64
		expectedDevice      *Device
	}{
		{
			name:                "no requests",
			req:                 []tagReq{{httpReq: &http.Request{}, kind: anonymous.AnonDevice}},
			expectedAnonCount:   0,
			expectedAuthedCount: 0,
		},
		{
			name: "missing info should not tag",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent": []string{"test"},
				},
			},
				kind: anonymous.AnonDevice,
			}},
			expectedAnonCount:   0,
			expectedAuthedCount: 0,
		},
		{
			name: "should tag once",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDevice,
			},
			},
			expectedAnonCount:   1,
			expectedAuthedCount: 0,
			expectedDevice: &Device{
				Kind:      anonymous.AnonDevice,
				IP:        "10.30.30.1",
				UserAgent: "test"},
		},
		{
			name: "repeat request should not tag",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDevice,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDevice,
			},
			},
			expectedAnonCount:   1,
			expectedAuthedCount: 0,
		}, {
			name: "authed request should untag anon",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDevice,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AuthedDevice,
			},
			},
			expectedAnonCount:   0,
			expectedAuthedCount: 1,
		}, {
			name: "anon request should untag authed",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AuthedDevice,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDevice,
			},
			},
			expectedAnonCount:   1,
			expectedAuthedCount: 0,
		},
		{
			name: "tag 4 different requests",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDevice,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.2"},
				},
			},
				kind: anonymous.AnonDevice,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.3"},
				},
			},
				kind: anonymous.AuthedDevice,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":      []string{"test"},
					"X-Forwarded-For": []string{"10.30.30.4"},
				},
			},
				kind: anonymous.AuthedDevice,
			},
			},
			expectedAnonCount:   2,
			expectedAuthedCount: 2,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			fakeStore := remotecache.NewFakeStore(t)

			anonService := ProvideAnonymousDeviceService(fakeStore, &usagestats.UsageStatsMock{})

			for _, req := range tc.req {
				err := anonService.TagDevice(context.Background(), req.httpReq, req.kind)
				require.NoError(t, err)
			}

			stats, err := anonService.usageStatFn(context.Background())
			require.NoError(t, err)

			assert.Equal(t, tc.expectedAnonCount, stats["stats.anonymous.session.count"].(int64))
			assert.Equal(t, tc.expectedAuthedCount, stats["stats.users.device.count"].(int64))

			if tc.expectedDevice != nil {
				key, err := tc.expectedDevice.Key()
				require.NoError(t, err)

				k, err := fakeStore.Get(context.Background(), key)
				require.NoError(t, err)

				gotDevice := &Device{}
				err = json.Unmarshal(k, gotDevice)
				require.NoError(t, err)

				assert.NotNil(t, gotDevice.LastSeen)
				gotDevice.LastSeen = time.Time{}

				assert.Equal(t, tc.expectedDevice, gotDevice)
			}
		})
	}
}

// Ensure that the local cache prevents request from being tagged
func TestIntegrationAnonDeviceService_localCacheSafety(t *testing.T) {
	fakeStore := remotecache.NewFakeStore(t)
	anonService := ProvideAnonymousDeviceService(fakeStore, &usagestats.UsageStatsMock{})

	req := &http.Request{
		Header: http.Header{
			"User-Agent":      []string{"test"},
			"X-Forwarded-For": []string{"10.30.30.2"},
		},
	}

	anonDevice := &Device{
		Kind:      anonymous.AnonDevice,
		IP:        "10.30.30.2",
		UserAgent: "test",
		LastSeen:  time.Now().UTC(),
	}

	key, err := anonDevice.Key()
	require.NoError(t, err)

	anonService.localCache.SetDefault(key, true)

	err = anonService.TagDevice(context.Background(), req, anonymous.AnonDevice)
	require.NoError(t, err)

	stats, err := anonService.usageStatFn(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(0), stats["stats.anonymous.session.count"].(int64))
}
