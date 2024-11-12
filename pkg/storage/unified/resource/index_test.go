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
	require.Equal(t, 1, len(index.allTenants()))
	assertSearchCountEquals(t, index, "*", nil, nil, 1)
}

func TestIndexFolder(t *testing.T) {
	data := readTestData(t, "folder-resource.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: data}}}
	index := newTestIndex(t, 1)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 1)
	assertSearchCountEquals(t, index, "*", nil, nil, 1)
}

func TestSearchFolder(t *testing.T) {
	dashboard := readTestData(t, "dashboard-resource.json")
	folder := readTestData(t, "folder-resource.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: dashboard}, {Value: folder}}}
	index := newTestIndex(t, 1)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 2)
	assertSearchCountEquals(t, index, "*", []string{"folder"}, nil, 1)
}

func TestSearchDashboardsAndFoldersOnly(t *testing.T) {
	dashboard := readTestData(t, "dashboard-resource.json")
	folder := readTestData(t, "folder-resource.json")
	playlist := readTestData(t, "playlist-resource.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: dashboard}, {Value: folder}, {Value: playlist}}}
	index := newTestIndex(t, 1)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 3)
	assertSearchCountEquals(t, index, "*", []string{"dashboard", "folder"}, nil, 2)
}

func TestLookupNames(t *testing.T) {
	records := 1000
	folders, ids := simulateFolders(records)
	list := &ListResponse{Items: []*ResourceWrapper{}}
	for _, f := range folders {
		list.Items = append(list.Items, &ResourceWrapper{Value: []byte(f)})
	}
	index := newTestIndex(t, 1)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, records)
	query := ""
	chunk := ids[:100] // query for n folders by id
	for _, id := range chunk {
		query += `"` + id + `" `
	}
	assertSearchCountEquals(t, index, query, nil, nil, int64(len(chunk)))
}

func TestIndexDashboardWithTags(t *testing.T) {
	dashboard := readTestData(t, "dashboard-resource.json")
	data := readTestData(t, "dashboard-tagged-resource.json")
	data2 := readTestData(t, "dashboard-tagged-resource2.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: dashboard}, {Value: data}, {Value: data2}}}
	index := newTestIndex(t, 2)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 3)
	assertSearchCountEquals(t, index, "*", nil, []string{"tag1"}, 2)
	assertSearchCountEquals(t, index, "*", nil, []string{"tag4"}, 1)
	assertSearchGroupCountEquals(t, index, "*", "tags", nil, 4)
	assertSearchGroupCountEquals(t, index, "*", "tags", []string{"tag4"}, 3)
}

func TestSort(t *testing.T) {
	dashboard := readTestData(t, "dashboard-resource.json")
	folder := readTestData(t, "folder-resource.json")
	playlist := readTestData(t, "playlist-resource.json")
	list := &ListResponse{Items: []*ResourceWrapper{{Value: dashboard}, {Value: folder}, {Value: playlist}}}
	index := newTestIndex(t, 1)

	err := index.writeBatch(testContext, list)
	require.NoError(t, err)

	assertCountEquals(t, index, 3)

	req := &SearchRequest{Query: "*", Tenant: testTenant, Limit: 4, Offset: 0, Kind: []string{"dashboard", "folder"}, SortBy: []string{"title"}}
	results, err := index.Search(testContext, req)
	require.NoError(t, err)

	val := results.Values[0]
	assert.Equal(t, "dashboard-a", val.Spec["title"])

	req = &SearchRequest{Query: "*", Tenant: testTenant, Limit: 4, Offset: 0, Kind: []string{"dashboard", "folder"}, SortBy: []string{"-title"}}
	results, err = index.Search(testContext, req)
	require.NoError(t, err)

	val = results.Values[0]
	assert.NotEqual(t, "dashboard-a", val.Spec["title"])
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
		shards: make(map[string]*Shard),
		log:    log.New("unifiedstorage.search.index"),
		opts: Opts{
			ListLimit: 5000,
			Workers:   10,
			BatchSize: batchSize,
		},
	}
}

func assertCountEquals(t *testing.T, index *Index, expected int) {
	total, err := index.Count()
	require.NoError(t, err)
	assert.Equal(t, expected, total)
}

func assertSearchCountEquals(t *testing.T, index *Index, search string, kind []string, filters []string, expected int64) {
	req := &SearchRequest{Query: search, Tenant: testTenant, Limit: expected + 1, Offset: 0, Kind: kind, Filters: filters}
	start := time.Now()
	results, err := index.Search(testContext, req)
	require.NoError(t, err)
	elapsed := time.Since(start)
	fmt.Println("Search time:", elapsed)
	assert.Equal(t, expected, int64(len(results.Values)))
}

func assertSearchGroupCountEquals(t *testing.T, index *Index, search string, group string, filters []string, expected int64) {
	groupBy := []*GroupBy{{Name: group, Limit: 100}}
	req := &SearchRequest{Query: search, Tenant: testTenant, Limit: 1, Offset: 0, GroupBy: groupBy, Filters: filters}
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

func simulateFolders(size int) ([]string, []string) {
	folders := []string{}
	ids := []string{}
	for i := 0; i < size; i++ {
		id := "folder-" + strconv.Itoa(i)
		folder := `{
			"kind": "Folder",
			"title": "test",
			"metadata": {
				"uid": "` + id + `",
				"name": "folder-` + strconv.Itoa(i) + `",
				"namespace": "default"
			},
			"spec": {
				"title": "test",
				"description": "test"
			}
		}`
		folders = append(folders, folder)
		ids = append(ids, id)
	}
	return folders, ids
}
