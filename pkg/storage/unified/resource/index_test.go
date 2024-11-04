package resource

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/exp/rand"
)

const testTenant = "default"

var testContext = context.Background()

func TestIndexDashboard(t *testing.T) {
	data := readTestData(t, "dashboard-resource.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: data}}}
	index := newTestIndex(t, 1)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 1)
	assertSearchCountEquals(t, index, "*", 1)
}

func TestIndexDashboardWithTags(t *testing.T) {
	data := readTestData(t, "dashboard-tagged-resource.json")
	data2 := readTestData(t, "dashboard-tagged-resource2.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: data}, {Value: data2}}}
	index := newTestIndex(t, 2)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 2)
	assertSearchCountEquals(t, index, "tag1", 2)
	assertSearchCountEquals(t, index, "tag4", 1)
	assertSearchGroupCountEquals(t, index, "*", "tags", 4)
	assertSearchGroupCountEquals(t, index, "tag4", "tags", 3)
}

func TestIndexBatch(t *testing.T) {
	index := newTestIndex(t, 1000)

	startAll := time.Now()
	ns := namespaces()
	// simulate 10 List calls
	for i := 0; i < 10; i++ {
		list := &ListResponse{Items: loadTestItems(strconv.Itoa(i), ns)}
		start := time.Now()
		_, err := index.AddToBatches(testContext, list)
		require.NoError(t, err)
		elapsed := time.Since(start)
		fmt.Println("Time elapsed:", elapsed)
	}

	// index all batches for each shard/tenant
	err := index.IndexBatches(testContext, 1, ns)
	require.NoError(t, err)

	elapsed := time.Since(startAll)
	fmt.Println("Total Time elapsed:", elapsed)

	assert.Equal(t, len(ns), len(index.shards))
	assertCountEquals(t, index, 100000)
}

func loadTestItems(uid string, tenants []string) []*ResourceWrapper {
	resource := `{
		"kind": "<kind>",
		"title": "test",
		"metadata": {
			"uid": "<uid>",
			"name": "test",
			"namespace": "<ns>"
		},
		"spec": {
			"title": "test",
			"description": "test",
			"interval": "5m"
		}
	}`

	items := []*ResourceWrapper{}
	for i := 0; i < 10000; i++ {
		res := strings.Replace(resource, "<uid>", strconv.Itoa(i)+uid, 1)
		// shuffle kinds
		kind := kinds[rand.Intn(len(kinds))]
		res = strings.Replace(res, "<kind>", kind, 1)
		// shuffle namespaces
		ns := tenants[rand.Intn(len(tenants))]
		res = strings.Replace(res, "<ns>", ns, 1)
		items = append(items, &ResourceWrapper{Value: []byte(res)})
	}
	return items
}

var kinds = []string{
	"playlist",
	"folder",
}

// simulate many tenants ( cloud )
func namespaces() []string {
	ns := []string{}
	for i := 0; i < 1000; i++ {
		ns = append(ns, "tenant"+strconv.Itoa(i))
	}
	return ns
}

func newTestIndex(t *testing.T, batchSize int) *Index {
	tracingCfg := tracing.NewEmptyTracingConfig()
	trace, err := tracing.ProvideService(tracingCfg)
	require.NoError(t, err)

	return &Index{
		tracer: trace,
		shards: make(map[string]Shard),
		log:    log.New("unifiedstorage.search.index"),
		opts: Opts{
			ListLimit: 5000,
			Workers:   10,
			BatchSize: batchSize,
		},
	}
}

func assertCountEquals(t *testing.T, index *Index, expected uint64) {
	total, err := index.Count()
	require.NoError(t, err)
	assert.Equal(t, expected, total)
}

func assertSearchCountEquals(t *testing.T, index *Index, search string, expected int64) {
	req := &SearchRequest{Query: search, Tenant: testTenant, Limit: expected + 1, Offset: 0}
	results, err := index.Search(testContext, req)
	require.NoError(t, err)
	assert.Equal(t, expected, int64(len(results.Values)))
}

func assertSearchGroupCountEquals(t *testing.T, index *Index, search string, group string, expected int64) {
	groupBy := []*GroupBy{{Name: group, Limit: 100}}
	req := &SearchRequest{Query: search, Tenant: testTenant, Limit: expected + 1, Offset: 0, GroupBy: groupBy}
	results, err := index.Search(testContext, req)
	require.NoError(t, err)
	assert.Equal(t, expected, int64(len(results.Groups)))
}

func readTestData(t *testing.T, name string) []byte {
	// We can ignore the gosec G304 because this is only for tests
	// nolint:gosec
	data, err := os.ReadFile("./testdata/" + name)
	require.NoError(t, err)
	return data
}
