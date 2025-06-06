package anonimpl

import (
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/usagestats"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"
	"github.com/grafana/grafana/pkg/services/anonymous"
	"github.com/grafana/grafana/pkg/services/anonymous/anonimpl/anonstore"
	"github.com/grafana/grafana/pkg/services/anonymous/validator"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/authn/authntest"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationDeviceService_tag(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	type tagReq struct {
		httpReq *http.Request
		kind    anonymous.DeviceKind
	}
	testCases := []struct {
		name                string
		req                 []tagReq
		expectedAnonUICount int64
		expectedKey         string
		expectedDevice      *anonstore.Device
		disableService      bool
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
			expectedDevice: &anonstore.Device{
				DeviceID:  "32mdo31deeqwes",
				ClientIP:  "10.30.30.1",
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
		{
			name: "when the service is disabled, read operations return empty",
			req: []tagReq{
				{
					httpReq: &http.Request{
						Header: http.Header{
							"User-Agent":                            []string{"testdisabled"},
							"X-Forwarded-For":                       []string{"10.33.33.3"},
							http.CanonicalHeaderKey(deviceIDHeader): []string{"t35td154b13d1d"},
						},
					},
					kind: anonymous.AnonDeviceUI,
				},
			},
			disableService:      true,
			expectedAnonUICount: 0,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()

			store := db.InitTestDB(t)

			cfg := setting.NewCfg()
			cfg.Anonymous.Enabled = !tc.disableService

			anonService := ProvideAnonymousDeviceService(
				&usagestats.UsageStatsMock{}, &authntest.FakeService{}, store, cfg, orgtest.NewOrgServiceFake(),
				nil, actest.FakeAccessControl{}, &routing.RouteRegisterImpl{}, validator.FakeAnonUserLimitValidator{},
			)

			for _, req := range tc.req {
				err := anonService.TagDevice(ctx, req.httpReq, req.kind)
				require.NoError(t, err)

				t.Cleanup(func() {
					anonService.untagDevice(ctx, nil, &authn.Request{HTTPRequest: req.httpReq}, nil)
				})
			}

			devices, err := anonService.ListDevices(ctx, nil, nil)
			require.NoError(t, err)
			require.Len(t, devices, int(tc.expectedAnonUICount))
			if tc.expectedDevice != nil {
				device := devices[0]
				assert.NotZero(t, device.ID)
				assert.NotZero(t, device.CreatedAt)
				assert.NotZero(t, device.UpdatedAt)

				tc.expectedDevice.ID = device.ID
				tc.expectedDevice.CreatedAt = device.CreatedAt
				tc.expectedDevice.UpdatedAt = device.UpdatedAt

				assert.Equal(t, tc.expectedDevice, devices[0])
			}

			// One minute is added to the end time as mysql 5.7 datetime type has a default precision of seconds and not milis.
			to := time.Now().Add(time.Minute)
			from := to.AddDate(0, 0, -1)

			devicesCount, err := anonService.CountDevices(ctx, from, to)
			require.NoError(t, err)
			require.Equal(t, tc.expectedAnonUICount, devicesCount)

			devicesFound, err := anonService.SearchDevices(ctx, &anonstore.SearchDeviceQuery{
				From: from,
				To:   to,
			})
			require.NoError(t, err)
			if tc.expectedAnonUICount > 0 {
				require.NotNil(t, devicesFound)
				require.Equal(t, tc.expectedAnonUICount, devicesFound.TotalCount)
			}

			stats, err := anonService.usageStatFn(context.Background())
			require.NoError(t, err)

			if !tc.disableService {
				assert.Equal(t, tc.expectedAnonUICount, stats["stats.anonymous.device.ui.count"].(int64), stats)
			}
		})
	}
}

// Ensure that the local cache prevents request from being tagged
func TestIntegrationAnonDeviceService_localCacheSafety(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}
	store := db.InitTestDB(t)
	anonService := ProvideAnonymousDeviceService(&usagestats.UsageStatsMock{},
		&authntest.FakeService{}, store, setting.NewCfg(), orgtest.NewOrgServiceFake(), nil, actest.FakeAccessControl{}, &routing.RouteRegisterImpl{}, validator.FakeAnonUserLimitValidator{})

	req := &http.Request{
		Header: http.Header{
			"User-Agent":                            []string{"test"},
			"X-Forwarded-For":                       []string{"10.30.30.2"},
			http.CanonicalHeaderKey(deviceIDHeader): []string{"32mdo31deeqwes"},
		},
	}

	anonDevice := &anonstore.Device{
		DeviceID:  "32mdo31deeqwes",
		ClientIP:  "10.30.30.2",
		UserAgent: "test",
		UpdatedAt: time.Now().UTC(),
	}

	key := anonDevice.CacheKey()
	anonService.localCache.SetDefault(key, true)

	err := anonService.TagDevice(context.Background(), req, anonymous.AnonDeviceUI)
	require.NoError(t, err)

	stats, err := anonService.usageStatFn(context.Background())
	require.NoError(t, err)

	assert.Equal(t, int64(0), stats["stats.anonymous.device.ui.count"].(int64))
}

func TestIntegrationDeviceService_SearchDevice(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}

	fixedTime := time.Date(2024, 1, 1, 12, 0, 0, 0, time.UTC) // Fixed timestamp for testing

	testCases := []struct {
		name           string
		insertDevices  []*anonstore.Device
		searchQuery    anonstore.SearchDeviceQuery
		expectedCount  int
		expectedDevice *anonstore.Device
	}{
		{
			name: "two devices and limit set to 1",
			insertDevices: []*anonstore.Device{
				{
					DeviceID:  "32mdo31deeqwes",
					ClientIP:  "",
					UserAgent: "test",
				},
				{
					DeviceID:  "32mdo31deeqwes2",
					ClientIP:  "",
					UserAgent: "test2",
				},
			},
			searchQuery: anonstore.SearchDeviceQuery{
				Query: "",
				Page:  1,
				Limit: 1,
				From:  fixedTime,
				To:    fixedTime.Add(1 * time.Hour),
			},
			expectedCount: 1,
		},
		{
			name: "two devices and search for client ip 192.1",
			insertDevices: []*anonstore.Device{
				{
					DeviceID:  "32mdo31deeqwes",
					ClientIP:  "192.168.0.2:10",
					UserAgent: "",
				},
				{
					DeviceID:  "32mdo31deeqwes2",
					ClientIP:  "192.268.1.3:200",
					UserAgent: "",
				},
			},
			searchQuery: anonstore.SearchDeviceQuery{
				Query: "192.1",
				Page:  1,
				Limit: 50,
				From:  fixedTime,
				To:    fixedTime.Add(1 * time.Hour),
			},
			expectedCount: 1,
			expectedDevice: &anonstore.Device{
				DeviceID:  "32mdo31deeqwes",
				ClientIP:  "192.168.0.2:10",
				UserAgent: "",
			},
		},
		{
			name: "device with IPv6 address and case-insensitive search",
			insertDevices: []*anonstore.Device{
				{
					DeviceID: "32mdo31deeqwes",
					ClientIP: "[2001:db8:3333:4444:cccc:DDDD:eeee:FFFF]:1000", // Using mixed-case to test case insensitivity
				},
			},
			searchQuery: anonstore.SearchDeviceQuery{
				Query: "CCCC", // Different case to test case insensitivity
				Page:  1,
				Limit: 50,
				From:  fixedTime,
				To:    fixedTime.Add(1 * time.Hour),
			},
			expectedCount: 1,
			expectedDevice: &anonstore.Device{
				DeviceID: "32mdo31deeqwes",
				ClientIP: "[2001:db8:3333:4444:cccc:DDDD:eeee:FFFF]:1000",
			},
		}}
	store := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.Anonymous.Enabled = true
	anonService := ProvideAnonymousDeviceService(&usagestats.UsageStatsMock{}, &authntest.FakeService{}, store, cfg, orgtest.NewOrgServiceFake(), nil, actest.FakeAccessControl{}, &routing.RouteRegisterImpl{}, validator.FakeAnonUserLimitValidator{})

	for _, tc := range testCases {
		err := store.Reset()
		assert.NoError(t, err)
		t.Run(tc.name, func(t *testing.T) {
			for _, device := range tc.insertDevices {
				device.CreatedAt = fixedTime.Add(-10 * time.Hour) // Use fixed time
				device.UpdatedAt = fixedTime
				err := anonService.anonStore.CreateOrUpdateDevice(context.Background(), device)
				require.NoError(t, err)
			}

			devices, err := anonService.anonStore.SearchDevices(context.Background(), &tc.searchQuery)
			require.NoError(t, err)
			require.Len(t, devices.Devices, tc.expectedCount)
			if tc.expectedDevice != nil {
				device := devices.Devices[0]
				require.Equal(t, tc.expectedDevice.UserAgent, device.UserAgent)
			}
		})
	}
}

func TestIntegrationAnonDeviceService_DeviceLimitWithCache(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode")
	}
	// Setup test environment
	store := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.Anonymous.DeviceLimit = 1 // Set device limit to 1 for testing
	anonService := ProvideAnonymousDeviceService(
		&usagestats.UsageStatsMock{},
		&authntest.FakeService{},
		store,
		cfg,
		orgtest.NewOrgServiceFake(),
		nil,
		actest.FakeAccessControl{},
		&routing.RouteRegisterImpl{},
		validator.FakeAnonUserLimitValidator{},
	)

	// Define test cases
	testCases := []struct {
		name        string
		httpReq     *http.Request
		expectedErr error
	}{
		{
			name: "first request should succeed",
			httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					"X-Forwarded-For":                       []string{"10.30.30.1"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"device1"},
				},
			},
			expectedErr: nil,
		},
		{
			name: "second request should fail due to device limit",
			httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					"X-Forwarded-For":                       []string{"10.30.30.2"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"device2"},
				},
			},
			expectedErr: anonstore.ErrDeviceLimitReached,
		},
		{
			name: "repeat request should hit cache and succeed",
			httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					"X-Forwarded-For":                       []string{"10.30.30.1"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"device1"},
				},
			},
			expectedErr: nil,
		},
		{
			name: "third request should hit cache and fail due to device limit",
			httpReq: &http.Request{
				Header: http.Header{
					"User-Agent":                            []string{"test"},
					"X-Forwarded-For":                       []string{"10.30.30.2"},
					http.CanonicalHeaderKey(deviceIDHeader): []string{"device2"},
				},
			},
			expectedErr: anonstore.ErrDeviceLimitReached,
		},
	}

	// Run test cases
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := anonService.TagDevice(context.Background(), tc.httpReq, anonymous.AnonDeviceUI)
			if tc.expectedErr != nil {
				require.Error(t, err)
				assert.Equal(t, tc.expectedErr, err)
			} else {
				require.NoError(t, err)
			}
		})
	}
}
