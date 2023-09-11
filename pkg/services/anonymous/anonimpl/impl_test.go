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

func TestIntegrationDeviceService_tag(t *testing.T) {
	type tagReq struct {
		httpReq *http.Request
		kind    anonymous.DeviceKind
	}
	testCases := []struct {
		name                string
		req                 []tagReq
		expectedAnonUICount int64
		expectedKey         string
		expectedDevice      *Device
	}{
		{
			name: "no requests",
			req:  []tagReq{{httpReq: &http.Request{}, kind: anonymous.AnonDeviceUI}},
		},
		{
			name: "missing info should not tag",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent": []string{"test"},
				},
			},
				kind: anonymous.AnonDeviceUI,
			}},
		},
		{
			name: "should tag device ID once",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					"X-Forwarded-For":                       []string{"10.30.30.1"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"32mdo31deeqwes"},
				},
			},
				kind: anonymous.AnonDeviceUI,
			},
			},
			expectedAnonUICount: 1,
			expectedKey:         "ui-anon-session:32mdo31deeqwes",
			expectedDevice: &Device{
				Kind:      anonymous.AnonDeviceUI,
				IP:        "10.30.30.1",
				UserAgent: "test"},
		},
		{
			name: "repeat request should not tag",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"32mdo31deeqwes"},
					"X-Forwarded-For":                       []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDeviceUI,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"32mdo31deeqwes"},
					"X-Forwarded-For":                       []string{"10.30.30.1"},
				},
			},
				kind: anonymous.AnonDeviceUI,
			},
			},
			expectedAnonUICount: 1,
		}, {
			name: "tag 2 different requests",
			req: []tagReq{{httpReq: &http.Request{
				Header: http.Header{
					http.CanonicalHeaderKey("User-Agent"):      []string{"test"},
					http.CanonicalHeaderKey("X-Forwarded-For"): []string{"10.30.30.1"},
					http.CanonicalHeaderKey(deviceIDHeader):    []string{"a"},
				},
			},
				kind: anonymous.AnonDeviceUI,
			}, {httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					"X-Forwarded-For":                       []string{"10.30.30.2"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"b"},
				},
			},
				kind: anonymous.AnonDeviceUI,
			},
			},
			expectedAnonUICount: 2,
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

			assert.Equal(t, tc.expectedAnonUICount, stats["stats.anonymous.device.ui.count"].(int64))

			if tc.expectedDevice != nil {
				key := tc.expectedKey

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
			"User-Agent":                            []string{"test"},
			"X-Forwarded-For":                       []string{"10.30.30.2"},
			http.CanonicalHeaderKey(deviceIDHeader): []string{"32mdo31deeqwes"},
		},
	}

	anonDevice := &Device{
		Kind:      anonymous.AnonDeviceUI,
		IP:        "10.30.30.2",
		UserAgent: "test",
		LastSeen:  time.Now().UTC(),
	}

	key, err := anonDevice.UIKey("32mdo31deeqwes")
	require.NoError(t, err)

	anonService.localCache.SetDefault(key, true)

	err = anonService.TagDevice(context.Background(), req, anonymous.AnonDeviceUI)
	require.NoError(t, err)

	stats, err := anonService.usageStatFn(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(0), stats["stats.anonymous.device.ui.count"].(int64))
}
