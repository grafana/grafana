package anonstore

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

func TestIntegrationAnonStore_DeleteDevicesOlderThan(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	store := db.InitTestDB(t)
	anonDBStore := ProvideAnonDBStore(store, 0)
	const keepFor = time.Hour * 24 * 61

	anonDevice := &Device{
		DeviceID:  "32mdo31deeqwes",
		ClientIP:  "10.30.30.2",
		UserAgent: "test",
		UpdatedAt: time.Now().Add(-keepFor).Add(-time.Hour),
	}

	err := anonDBStore.CreateOrUpdateDevice(context.Background(), anonDevice)
	require.NoError(t, err)

	anonDevice.DeviceID = "keep"
	anonDevice.UpdatedAt = time.Now().Add(-time.Hour)

	err = anonDBStore.CreateOrUpdateDevice(context.Background(), anonDevice)
	require.NoError(t, err)

	from := time.Now().Add(-2 * keepFor)
	to := time.Now()

	count, err := anonDBStore.CountDevices(context.Background(), from, to)
	require.NoError(t, err)
	require.Equal(t, int64(2), count)

	err = anonDBStore.DeleteDevicesOlderThan(context.Background(), time.Now().Add(-keepFor))
	require.NoError(t, err)

	devices, err := anonDBStore.ListDevices(context.Background(), &from, &to)
	require.NoError(t, err)
	require.Equal(t, 1, len(devices))
	assert.Equal(t, "keep", devices[0].DeviceID)
}

func TestIntegrationBeyondDeviceLimit(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	store := db.InitTestDB(t)
	anonDBStore := ProvideAnonDBStore(store, 1)

	anonDevice := &Device{
		DeviceID:  "32mdo31deeqwes",
		ClientIP:  "10.30.30.2",
		UserAgent: "test",
		UpdatedAt: time.Now().Add(-time.Hour),
	}

	err := anonDBStore.CreateOrUpdateDevice(context.Background(), anonDevice)
	require.NoError(t, err)

	anonDevice.DeviceID = "keep"
	anonDevice.UpdatedAt = time.Now().Add(-time.Hour)

	err = anonDBStore.CreateOrUpdateDevice(context.Background(), anonDevice)
	require.ErrorIs(t, err, ErrDeviceLimitReached)
}

func TestIntegrationAnonStore_DeleteDevice(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping integration test in short mode")
	}
	store := db.InitTestDB(t)
	anonDBStore := ProvideAnonDBStore(store, 0)
	const keepFor = time.Hour * 24 * 61

	anonDevice := &Device{
		DeviceID:  "32mdo31deeqwes",
		ClientIP:  "10.30.30.2",
		UserAgent: "test",
		UpdatedAt: time.Now().Add(-keepFor).Add(-time.Hour),
	}

	err := anonDBStore.CreateOrUpdateDevice(context.Background(), anonDevice)
	require.NoError(t, err)

	from := time.Now().Add(-2 * keepFor)
	to := time.Now()

	count, err := anonDBStore.CountDevices(context.Background(), from, to)
	require.NoError(t, err)
	require.Equal(t, int64(1), count)

	err = anonDBStore.DeleteDevice(context.Background(), "32mdo31deeqwes")
	require.NoError(t, err)

	devices, err := anonDBStore.ListDevices(context.Background(), &from, &to)
	require.NoError(t, err)
	require.Equal(t, 0, len(devices))
}
