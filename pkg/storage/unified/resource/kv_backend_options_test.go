package resource

import (
	"reflect"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

// callerSuppliedFields lists the options NewKVBackendOptions does not set, and
// why. A field that is neither set nor listed here fails the test below, so
// adding an option forces a decision about where its value comes from.
var callerSuppliedFields = map[string]string{
	"KvStore":                  "the store itself; chosen by the wiring",
	"ExperimentalKV":           "an alternative store; chosen by the wiring",
	"Reg":                      "metrics registry owned by the caller",
	"Log":                      "logger owned by the caller",
	"DBKeepAlive":              "reference to the caller's database provider",
	"GCGate":                   "shared with the caller's startup sequencing",
	"UseChannelNotifier":       "derived from high-availability detection, not from a single setting",
	"RvManager":                "built by the caller from a live database connection",
	"EventPublisher":           "NATS publisher injected by the caller",
	"EventSubscriber":          "NATS subscriber injected by the caller",
	"EnableNatsNotifier":       "set together with EventSubscriber by the caller",
	"EnableNatsNotifierShadow": "set together with EventSubscriber by the caller",
	"EmbeddingDeleter":         "vector backend injected by the caller",

	// The lease options are set together, and the holder comes from
	// sql.ResolveLeaseHolder, which this package cannot import.
	"EnableKVLeases": "set together with Holder, which the caller resolves",
	"Holder":         "resolved by sql.ResolveLeaseHolder, which this package cannot call",
	"LeaseTTL":       "set together with Holder, which the caller resolves",
	"LeaseAutoRenew": "set together with Holder, which the caller resolves",

	"WatchOptions.BufferSize": "no setting; defaulted in WatchOptions.normalize",
	"WatchOptions.MinBackoff": "no setting; defaulted in WatchOptions.normalize",
	"WatchOptions.MaxBackoff": "no setting; defaulted in WatchOptions.normalize",

	"TenantWatcherConfig.ResyncInterval": "no setting; defaulted by the tenant watcher",
	"TenantWatcherConfig.RetryMaxDelay":  "no setting; defaulted by the tenant watcher",
}

func TestNewKVBackendOptionsSetsEveryConfigDerivedField(t *testing.T) {
	opts := NewKVBackendOptions(fullyPopulatedCfg())

	requirePopulated(t, reflect.ValueOf(opts), "")
}

func requirePopulated(t *testing.T, v reflect.Value, path string) {
	t.Helper()

	typ := v.Type()
	for i := range typ.NumField() {
		field := typ.Field(i)
		if !field.IsExported() {
			continue
		}

		fieldPath := field.Name
		if path != "" {
			fieldPath = path + "." + field.Name
		}
		if _, ok := callerSuppliedFields[fieldPath]; ok {
			continue
		}

		value := v.Field(i)
		require.Falsef(t, value.IsZero(),
			"%s is zero: either populate it in NewKVBackendOptions or add it to callerSuppliedFields with a reason",
			fieldPath)

		switch value.Kind() {
		case reflect.Struct:
			requirePopulated(t, value, fieldPath)
		case reflect.Pointer:
			if value.Elem().Kind() == reflect.Struct {
				requirePopulated(t, value.Elem(), fieldPath)
			}
		}
	}
}

// The walk above only checks for non-zero, so it cannot catch two settings
// swapped between options. These assertions can.
func TestNewKVBackendOptionsValues(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.MaxFileIndexAge = 1 * time.Minute
	cfg.EventRetentionPeriod = 2 * time.Minute
	cfg.EventPruningInterval = 3 * time.Minute
	cfg.SearchLookback = 4 * time.Minute
	cfg.NotifierSettleDelay = 5 * time.Minute
	cfg.DashboardVersionsToKeep = 7
	cfg.EnableGarbageCollection = true
	cfg.GarbageCollectionDryRun = true
	cfg.GarbageCollectionInterval = 6 * time.Minute
	cfg.GarbageCollectionBatchSize = 8
	cfg.GarbageCollectionBatchWait = 7 * time.Minute
	cfg.GarbageCollectionMaxAge = 8 * time.Minute
	cfg.DashboardsGarbageCollectionMaxAge = 9 * time.Minute

	opts := NewKVBackendOptions(cfg)

	require.Equal(t, 1*time.Minute, opts.LastImportTimeMaxAge)
	require.Equal(t, 2*time.Minute, opts.EventRetentionPeriod)
	require.Equal(t, 3*time.Minute, opts.EventPruningInterval)
	require.Equal(t, 4*time.Minute, opts.SearchLookback)
	require.Equal(t, WatchOptions{SettleDelay: 5 * time.Minute}, opts.WatchOptions)
	require.Equal(t, 7, opts.DashboardVersionsToKeep)
	require.Equal(t, GarbageCollectionConfig{
		Enabled:          true,
		DryRun:           true,
		Interval:         6 * time.Minute,
		BatchSize:        8,
		BatchWait:        7 * time.Minute,
		MaxAge:           8 * time.Minute,
		DashboardsMaxAge: 9 * time.Minute,
	}, opts.GarbageCollection)
}

// fullyPopulatedCfg sets every scalar setting to a non-zero value, so an option
// that comes out zero was not read from the config at all.
func fullyPopulatedCfg() *setting.Cfg {
	cfg := setting.NewCfg()

	v := reflect.ValueOf(cfg).Elem()
	for i := range v.NumField() {
		field := v.Field(i)
		if !field.CanSet() {
			continue
		}
		switch field.Kind() {
		case reflect.Bool:
			field.SetBool(true)
		case reflect.String:
			field.SetString("populated")
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			field.SetInt(int64(i + 1))
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			field.SetUint(uint64(i + 1))
		case reflect.Float32, reflect.Float64:
			field.SetFloat(float64(i + 1))
		}
	}

	// The tenant watcher reads these from an ini section rather than a field,
	// and drops the insecure-TLS flag outside development.
	cfg.Env = setting.Dev
	grpcSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	grpcSection.Key("token").SetValue("token")
	grpcSection.Key("token_exchange_url").SetValue("https://example.com/token-exchange")

	return cfg
}
