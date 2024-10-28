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
	"golang.org/x/exp/rand"
)

func TestIndexBatch(t *testing.T) {
	tracingCfg := tracing.NewEmptyTracingConfig()
	trace, err := tracing.ProvideService(tracingCfg)
	if err != nil {
		t.Fatal(err)
		return
	}

	tmpdir := os.TempDir() + "testindexbatch"

	defer func() {
		err := os.RemoveAll(tmpdir)
		if err != nil {
			t.Fatal(err)
			return
		}
	}()

	index := &Index{
		tracer: trace,
		shards: make(map[string]Shard),
		path:   tmpdir,
		log:    log.New("unifiedstorage.search.index"),
	}

	ctx := context.Background()
	startAll := time.Now()

	// simulate 10 List calls
	for i := 0; i < 10; i++ {
		list := &ListResponse{Items: loadTestItems(strconv.Itoa(i))}
		start := time.Now()
		err = index.IndexBatch(ctx, list)
		if err != nil {
			t.Fatal(err)
			return
		}
		elapsed := time.Since(start)
		fmt.Println("Time elapsed:", elapsed)
	}

	elapsed := time.Since(startAll)
	fmt.Println("Total Time elapsed:", elapsed)

	assert.Equal(t, 3, len(index.shards))

	total, err := index.Count()
	if err != nil {
		t.Fatal(err)
		return
	}

	assert.Equal(t, uint64(100000), total)
}

func loadTestItems(uid string) []*ResourceWrapper {
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
		kind := namespaces[rand.Intn(len(kinds))]
		res = strings.Replace(res, "<kind>", kind, 1)
		// shuffle namespaces
		ns := namespaces[rand.Intn(len(namespaces))]
		res = strings.Replace(res, "<ns>", ns, 1)
		items = append(items, &ResourceWrapper{Value: []byte(res)})
	}
	return items
}

var namespaces = []string{
	"tenant1",
	"tenant2",
	"tenant3",
}

var kinds = []string{
	"playlist",
	"folder",
}
