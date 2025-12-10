package conversion

import (
	"context"
	"sync/atomic"
	"testing"
	"time"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	dashv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	dashv2alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2alpha1"
	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration"
	"github.com/grafana/grafana/apps/dashboard/pkg/migration/schemaversion"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// countingDataSourceProvider tracks how many times Index() is called
type countingDataSourceProvider struct {
	datasources []schemaversion.DataSourceInfo
	callCount   atomic.Int64
}

func newCountingDataSourceProvider(datasources []schemaversion.DataSourceInfo) *countingDataSourceProvider {
	return &countingDataSourceProvider{
		datasources: datasources,
	}
}

func (p *countingDataSourceProvider) Index(_ context.Context) *schemaversion.DatasourceIndex {
	p.callCount.Add(1)
	return schemaversion.NewDatasourceIndex(p.datasources)
}

func (p *countingDataSourceProvider) getCallCount() int64 {
	return p.callCount.Load()
}

// countingLibraryElementProvider tracks how many times GetLibraryElementInfo() is called
type countingLibraryElementProvider struct {
	elements  []schemaversion.LibraryElementInfo
	callCount atomic.Int64
}

func newCountingLibraryElementProvider(elements []schemaversion.LibraryElementInfo) *countingLibraryElementProvider {
	return &countingLibraryElementProvider{
		elements: elements,
	}
}

func (p *countingLibraryElementProvider) GetLibraryElementInfo(_ context.Context) []schemaversion.LibraryElementInfo {
	p.callCount.Add(1)
	return p.elements
}

func (p *countingLibraryElementProvider) getCallCount() int64 {
	return p.callCount.Load()
}

// createTestV0Dashboard creates a minimal v0 dashboard for testing
// The dashboard has a datasource with UID only (no type) to force provider lookup
// and includes library panels to test library element provider caching
func createTestV0Dashboard(namespace, title string) *dashv0.Dashboard {
	return &dashv0.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-dashboard",
			Namespace: namespace,
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         title,
				"schemaVersion": schemaversion.LATEST_VERSION,
				// Variables with datasource reference that requires lookup
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "query_var",
							"type":  "query",
							"query": "label_values(up, job)",
							// Datasource with UID only - type needs to be looked up
							"datasource": map[string]interface{}{
								"uid": "ds1",
								// type is intentionally omitted to trigger provider lookup
							},
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Test Panel",
						"type":  "timeseries",
						"targets": []interface{}{
							map[string]interface{}{
								// Datasource with UID only - type needs to be looked up
								"datasource": map[string]interface{}{
									"uid": "ds1",
								},
							},
						},
					},
					// Library panel reference - triggers library element provider lookup
					map[string]interface{}{
						"id":    2,
						"title": "Library Panel with Horizontal Repeat",
						"type":  "library-panel-ref",
						"gridPos": map[string]interface{}{
							"h": 8,
							"w": 12,
							"x": 0,
							"y": 8,
						},
						"libraryPanel": map[string]interface{}{
							"uid":  "lib-panel-repeat-h",
							"name": "Library Panel with Horizontal Repeat",
						},
					},
					// Another library panel reference
					map[string]interface{}{
						"id":    3,
						"title": "Library Panel without Repeat",
						"type":  "library-panel-ref",
						"gridPos": map[string]interface{}{
							"h": 3,
							"w": 6,
							"x": 0,
							"y": 16,
						},
						"libraryPanel": map[string]interface{}{
							"uid":  "lib-panel-no-repeat",
							"name": "Library Panel without Repeat",
						},
					},
				},
			},
		},
	}
}

// createTestV1Dashboard creates a minimal v1beta1 dashboard for testing
// The dashboard has a datasource with UID only (no type) to force provider lookup
// and includes library panels to test library element provider caching
func createTestV1Dashboard(namespace, title string) *dashv1.Dashboard {
	return &dashv1.Dashboard{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "test-dashboard",
			Namespace: namespace,
		},
		Spec: common.Unstructured{
			Object: map[string]interface{}{
				"title":         title,
				"schemaVersion": schemaversion.LATEST_VERSION,
				// Variables with datasource reference that requires lookup
				"templating": map[string]interface{}{
					"list": []interface{}{
						map[string]interface{}{
							"name":  "query_var",
							"type":  "query",
							"query": "label_values(up, job)",
							// Datasource with UID only - type needs to be looked up
							"datasource": map[string]interface{}{
								"uid": "ds1",
								// type is intentionally omitted to trigger provider lookup
							},
						},
					},
				},
				"panels": []interface{}{
					map[string]interface{}{
						"id":    1,
						"title": "Test Panel",
						"type":  "timeseries",
						"targets": []interface{}{
							map[string]interface{}{
								// Datasource with UID only - type needs to be looked up
								"datasource": map[string]interface{}{
									"uid": "ds1",
								},
							},
						},
					},
					// Library panel reference - triggers library element provider lookup
					map[string]interface{}{
						"id":    2,
						"title": "Library Panel with Vertical Repeat",
						"type":  "library-panel-ref",
						"gridPos": map[string]interface{}{
							"h": 4,
							"w": 6,
							"x": 0,
							"y": 8,
						},
						"libraryPanel": map[string]interface{}{
							"uid":  "lib-panel-repeat-v",
							"name": "Library Panel with Vertical Repeat",
						},
					},
					// Another library panel reference
					map[string]interface{}{
						"id":    3,
						"title": "Library Panel without Repeat",
						"type":  "library-panel-ref",
						"gridPos": map[string]interface{}{
							"h": 3,
							"w": 6,
							"x": 6,
							"y": 8,
						},
						"libraryPanel": map[string]interface{}{
							"uid":  "lib-panel-no-repeat",
							"name": "Library Panel without Repeat",
						},
					},
				},
			},
		},
	}
}

// TestConversionCaching_V0_to_V2alpha1 verifies caching works when converting V0 to V2alpha1
func TestConversionCaching_V0_to_V2alpha1(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}
	elements := []schemaversion.LibraryElementInfo{
		{UID: "lib-panel-repeat-h", Name: "Library Panel with Horizontal Repeat", Type: "timeseries"},
		{UID: "lib-panel-no-repeat", Name: "Library Panel without Repeat", Type: "graph"},
	}

	underlyingDS := newCountingDataSourceProvider(datasources)
	underlyingLE := newCountingLibraryElementProvider(elements)

	cachedDS := schemaversion.WrapIndexProviderWithCache(underlyingDS, time.Minute)
	cachedLE := schemaversion.WrapLibraryElementProviderWithCache(underlyingLE, time.Minute)

	migration.ResetForTesting()
	migration.Initialize(cachedDS, cachedLE, migration.DefaultCacheTTL)

	// Convert multiple dashboards in the same namespace
	numDashboards := 5
	namespace := "default"

	for i := 0; i < numDashboards; i++ {
		source := createTestV0Dashboard(namespace, "Dashboard "+string(rune('A'+i)))
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V0_to_V2alpha1(source, target, nil, cachedDS, cachedLE)
		require.NoError(t, err, "conversion %d should succeed", i)
		require.NotNil(t, target.Spec)
	}

	// With caching, the underlying datasource provider should only be called once per namespace
	// The test dashboard has datasources without type that require lookup
	assert.Equal(t, int64(1), underlyingDS.getCallCount(),
		"datasource provider should be called only once for %d conversions in same namespace", numDashboards)
	// Library element provider should also be called only once per namespace due to caching
	assert.Equal(t, int64(1), underlyingLE.getCallCount(),
		"library element provider should be called only once for %d conversions in same namespace", numDashboards)
}

// TestConversionCaching_V0_to_V2beta1 verifies caching works when converting V0 to V2beta1
func TestConversionCaching_V0_to_V2beta1(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}
	elements := []schemaversion.LibraryElementInfo{
		{UID: "lib-panel-repeat-h", Name: "Library Panel with Horizontal Repeat", Type: "timeseries"},
		{UID: "lib-panel-no-repeat", Name: "Library Panel without Repeat", Type: "graph"},
	}

	underlyingDS := newCountingDataSourceProvider(datasources)
	underlyingLE := newCountingLibraryElementProvider(elements)

	cachedDS := schemaversion.WrapIndexProviderWithCache(underlyingDS, time.Minute)
	cachedLE := schemaversion.WrapLibraryElementProviderWithCache(underlyingLE, time.Minute)

	migration.ResetForTesting()
	migration.Initialize(cachedDS, cachedLE, migration.DefaultCacheTTL)

	numDashboards := 5
	namespace := "default"

	for i := 0; i < numDashboards; i++ {
		source := createTestV0Dashboard(namespace, "Dashboard "+string(rune('A'+i)))
		target := &dashv2beta1.Dashboard{}

		err := Convert_V0_to_V2beta1(source, target, nil, cachedDS, cachedLE)
		require.NoError(t, err, "conversion %d should succeed", i)
		require.NotNil(t, target.Spec)
	}

	assert.Equal(t, int64(1), underlyingDS.getCallCount(),
		"datasource provider should be called only once for %d conversions in same namespace", numDashboards)
	assert.Equal(t, int64(1), underlyingLE.getCallCount(),
		"library element provider should be called only once for %d conversions in same namespace", numDashboards)
}

// TestConversionCaching_V1beta1_to_V2alpha1 verifies caching works when converting V1beta1 to V2alpha1
func TestConversionCaching_V1beta1_to_V2alpha1(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}
	elements := []schemaversion.LibraryElementInfo{
		{UID: "lib-panel-repeat-v", Name: "Library Panel with Vertical Repeat", Type: "timeseries"},
		{UID: "lib-panel-no-repeat", Name: "Library Panel without Repeat", Type: "graph"},
	}

	underlyingDS := newCountingDataSourceProvider(datasources)
	underlyingLE := newCountingLibraryElementProvider(elements)

	cachedDS := schemaversion.WrapIndexProviderWithCache(underlyingDS, time.Minute)
	cachedLE := schemaversion.WrapLibraryElementProviderWithCache(underlyingLE, time.Minute)

	migration.ResetForTesting()
	migration.Initialize(cachedDS, cachedLE, migration.DefaultCacheTTL)

	numDashboards := 5
	namespace := "default"

	for i := 0; i < numDashboards; i++ {
		source := createTestV1Dashboard(namespace, "Dashboard "+string(rune('A'+i)))
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V1beta1_to_V2alpha1(source, target, nil, cachedDS, cachedLE)
		require.NoError(t, err, "conversion %d should succeed", i)
		require.NotNil(t, target.Spec)
	}

	assert.Equal(t, int64(1), underlyingDS.getCallCount(),
		"datasource provider should be called only once for %d conversions in same namespace", numDashboards)
	assert.Equal(t, int64(1), underlyingLE.getCallCount(),
		"library element provider should be called only once for %d conversions in same namespace", numDashboards)
}

// TestConversionCaching_V1beta1_to_V2beta1 verifies caching works when converting V1beta1 to V2beta1
func TestConversionCaching_V1beta1_to_V2beta1(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}
	elements := []schemaversion.LibraryElementInfo{
		{UID: "lib-panel-repeat-v", Name: "Library Panel with Vertical Repeat", Type: "timeseries"},
		{UID: "lib-panel-no-repeat", Name: "Library Panel without Repeat", Type: "graph"},
	}

	underlyingDS := newCountingDataSourceProvider(datasources)
	underlyingLE := newCountingLibraryElementProvider(elements)

	cachedDS := schemaversion.WrapIndexProviderWithCache(underlyingDS, time.Minute)
	cachedLE := schemaversion.WrapLibraryElementProviderWithCache(underlyingLE, time.Minute)

	migration.ResetForTesting()
	migration.Initialize(cachedDS, cachedLE, migration.DefaultCacheTTL)

	numDashboards := 5
	namespace := "default"

	for i := 0; i < numDashboards; i++ {
		source := createTestV1Dashboard(namespace, "Dashboard "+string(rune('A'+i)))
		target := &dashv2beta1.Dashboard{}

		err := Convert_V1beta1_to_V2beta1(source, target, nil, cachedDS, cachedLE)
		require.NoError(t, err, "conversion %d should succeed", i)
		require.NotNil(t, target.Spec)
	}

	assert.Equal(t, int64(1), underlyingDS.getCallCount(),
		"datasource provider should be called only once for %d conversions in same namespace", numDashboards)
	assert.Equal(t, int64(1), underlyingLE.getCallCount(),
		"library element provider should be called only once for %d conversions in same namespace", numDashboards)
}

// TestConversionCaching_MultipleNamespaces verifies that different namespaces get separate cache entries
func TestConversionCaching_MultipleNamespaces(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}
	elements := []schemaversion.LibraryElementInfo{
		{UID: "lib-panel-repeat-h", Name: "Library Panel with Horizontal Repeat", Type: "timeseries"},
		{UID: "lib-panel-no-repeat", Name: "Library Panel without Repeat", Type: "graph"},
	}

	underlyingDS := newCountingDataSourceProvider(datasources)
	underlyingLE := newCountingLibraryElementProvider(elements)

	cachedDS := schemaversion.WrapIndexProviderWithCache(underlyingDS, time.Minute)
	cachedLE := schemaversion.WrapLibraryElementProviderWithCache(underlyingLE, time.Minute)

	migration.ResetForTesting()
	migration.Initialize(cachedDS, cachedLE, migration.DefaultCacheTTL)

	namespaces := []string{"default", "org-2", "org-3"}
	numDashboardsPerNs := 3

	for _, ns := range namespaces {
		for i := 0; i < numDashboardsPerNs; i++ {
			source := createTestV0Dashboard(ns, "Dashboard "+string(rune('A'+i)))
			target := &dashv2alpha1.Dashboard{}

			err := Convert_V0_to_V2alpha1(source, target, nil, cachedDS, cachedLE)
			require.NoError(t, err, "conversion for namespace %s should succeed", ns)
		}
	}

	// With caching, each namespace should result in one call to the underlying provider
	expectedCalls := int64(len(namespaces))
	assert.Equal(t, expectedCalls, underlyingDS.getCallCount(),
		"datasource provider should be called once per namespace (%d namespaces)", len(namespaces))
	assert.Equal(t, expectedCalls, underlyingLE.getCallCount(),
		"library element provider should be called once per namespace (%d namespaces)", len(namespaces))
}

// TestConversionCaching_CacheDisabled verifies that TTL=0 disables caching
func TestConversionCaching_CacheDisabled(t *testing.T) {
	datasources := []schemaversion.DataSourceInfo{
		{UID: "ds1", Type: "prometheus", Name: "Prometheus", Default: true},
	}
	elements := []schemaversion.LibraryElementInfo{
		{UID: "lib-panel-repeat-h", Name: "Library Panel with Horizontal Repeat", Type: "timeseries"},
		{UID: "lib-panel-no-repeat", Name: "Library Panel without Repeat", Type: "graph"},
	}

	underlyingDS := newCountingDataSourceProvider(datasources)
	underlyingLE := newCountingLibraryElementProvider(elements)

	// TTL of 0 should disable caching - the wrapper returns the underlying provider directly
	cachedDS := schemaversion.WrapIndexProviderWithCache(underlyingDS, 0)
	cachedLE := schemaversion.WrapLibraryElementProviderWithCache(underlyingLE, 0)

	migration.ResetForTesting()
	migration.Initialize(cachedDS, cachedLE, migration.DefaultCacheTTL)

	numDashboards := 3
	namespace := "default"

	for i := 0; i < numDashboards; i++ {
		source := createTestV0Dashboard(namespace, "Dashboard "+string(rune('A'+i)))
		target := &dashv2alpha1.Dashboard{}

		err := Convert_V0_to_V2alpha1(source, target, nil, cachedDS, cachedLE)
		require.NoError(t, err, "conversion %d should succeed", i)
	}

	// Without caching, each conversion calls the underlying provider multiple times
	// (once for each datasource lookup needed - variables and panels)
	// The key check is that the count is GREATER than 1 per conversion (no caching benefit)
	assert.Greater(t, underlyingDS.getCallCount(), int64(numDashboards),
		"with cache disabled, conversions should call datasource provider multiple times")
	// Library element provider is also called for each conversion without caching
	assert.GreaterOrEqual(t, underlyingLE.getCallCount(), int64(numDashboards),
		"with cache disabled, conversions should call library element provider multiple times")
}
