package test

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"reflect"
	"strconv"
	"testing"
	"testing/quick"

	badger "github.com/dgraph-io/badger/v4"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestBadgerKVStorageBackend(t *testing.T) {
	RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
		opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
		db, err := badger.Open(opts)
		require.NoError(t, err)
		t.Cleanup(func() {
			_ = db.Close()
		})
		kvOpts := resource.KVBackendOptions{
			KvStore: resource.NewBadgerKV(db),
		}
		backend, err := resource.NewKVStorageBackend(kvOpts)
		require.NoError(t, err)
		return backend
	}, &TestOptions{
		NSPrefix: "badgerkvstorage-test",
		SkipTests: map[string]bool{
			// TODO: fix these tests and remove this skip
			TestBlobSupport: true,
		},
	})
}

func TestIntegrationBenchmarkSQLKVStorageBackend(t *testing.T) {
	for _, withRvManager := range []bool{true, false} {
		t.Run(fmt.Sprintf("rvmanager=%t", withRvManager), func(t *testing.T) {
			testutil.SkipIntegrationTestInShortMode(t)

			opts := DefaultBenchmarkOptions(t)
			if db.IsTestDbSQLite() {
				opts.Concurrency = 1 // to avoid SQLite database is locked error
			}
			backend, dbConn := NewTestSqlKvBackend(t, t.Context(), withRvManager)
			dbConn.SqlDB().SetMaxOpenConns(min(max(10, opts.Concurrency), 100))
			RunStorageBackendBenchmark(t, backend, opts)
		})
	}
}

func TestIntegrationBenchmarkSQLKVStorageAndSearch(t *testing.T) {
	for _, withRvManager := range []bool{true, false} {
		t.Run(fmt.Sprintf("rvmanager=%t", withRvManager), func(t *testing.T) {
			t.Skip("skipping until https://github.com/grafana/search-and-storage-team/issues/659 is fixed")
			testutil.SkipIntegrationTestInShortMode(t)
			opts := DefaultBenchmarkOptions(t)
			if db.IsTestDbSQLite() {
				opts.Concurrency = 1
			}
			backend, _ := NewTestSqlKvBackend(t, t.Context(), withRvManager)
			searchBackend, err := search.NewBleveBackend(search.BleveOptions{
				Root:                   t.TempDir(),
				FileThreshold:          0,
				IndexMinUpdateInterval: opts.IndexMinUpdateInterval,
			}, nil)
			require.NoError(t, err)
			t.Cleanup(searchBackend.Stop)
			groupsResources := make(map[string]string, opts.NumResourceTypes)
			for i := 0; i < opts.NumResourceTypes; i++ {
				groupsResources[fmt.Sprintf("group-%d", i)] = fmt.Sprintf("resource-%d", i)
			}
			searchOpts := resource.SearchOptions{
				Backend: searchBackend,
				Resources: &resource.TestDocumentBuilderSupplier{
					GroupsResources: groupsResources,
				},
			}
			RunStorageAndSearchBenchmark(t, backend, searchOpts, opts)
		})
	}
}

func TestIntegrationSQLKVStorageBackend(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)

	skipTests := map[string]bool{
		TestBlobSupport: true,
	}

	t.Run("Without RvManager", func(t *testing.T) {
		RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			backend, _ := NewTestSqlKvBackend(t, ctx, false)
			return backend
		}, &TestOptions{
			NSPrefix:  "sqlkvstoragetest",
			SkipTests: skipTests,
		})
	})

	t.Run("With RvManager", func(t *testing.T) {
		RunStorageBackendTest(t, func(ctx context.Context) resource.StorageBackend {
			backend, _ := NewTestSqlKvBackend(t, ctx, true)
			return backend
		}, &TestOptions{
			NSPrefix:  "sqlkvstoragetest-rvmanager",
			SkipTests: skipTests,
		})
	})
}

type (
	BackendFn int

	BackendOperation struct {
		fn   BackendFn
		args []any
	}
)

const (
	seedEnvVar = "STORAGE_BACKEND_TESTING_RANDOM_SEED"

	WriteEventFn = BackendFn(iota)
	ReadResourceFn
	ListIteratorFn
	ListHistoryFn
	ListModifiedSinceFn
	GetResourceStatsFn
)

func newRandomSeed(t *testing.T) int64 {
	if seedStr := os.Getenv(seedEnvVar); seedStr != "" {
		seed, err := strconv.ParseInt(seedStr, 10, 64)
		require.NoError(t, err, "invalid seed declared in %s", seedEnvVar)

		return seed
	}

	return rand.Int63()
}

func newBadgerKV(t *testing.T) resource.KV {
	// Create a temporary directory for the test database
	opts := badger.DefaultOptions("").WithInMemory(true).WithLogger(nil)
	bdb, err := badger.Open(opts)
	require.NoError(t, err)
	t.Cleanup(func() {
		err := bdb.Close()
		require.NoError(t, err)
	})

	return resource.NewBadgerKV(bdb)
}

func TestIntegrationStorageBackendKVImplsPropertyTest(t *testing.T) {
	seed := newRandomSeed(t)
	rng := rand.New(rand.NewSource(seed))
	t.Logf("using random seed: %d", seed)

	// NOTE: the badger backend is NOT configured with rvManager because the
	// rvManager code path in storage_backend.go sets a GUID on the DataKey,
	// which produces keys with 4 tilde-separated parts (rv~action~folder~guid).
	// However, ParseKey (used by GetLatestAndPredecessor) expects only 3 parts
	// (rv~action~folder). This causes "invalid key" errors for badger because
	// badger stores the raw key string. The SQL backend avoids this because its
	// backward-compatible save decomposes the key into SQL columns.
	// This is a known bug: badger+rvManager is not a supported configuration.
	sqlKVBackend, _ := NewTestSqlKvBackend(t, t.Context(), false)

	badgerKV := newBadgerKV(t)
	badgerBackend, err := resource.NewKVStorageBackend(resource.KVBackendOptions{
		KvStore: badgerKV,
	})
	require.NoError(t, err)

	resourceID := func(key *resourcepb.ResourceKey) string {
		return fmt.Sprintf("%s~%s~%s~%s", key.Group, key.Resource, key.Namespace, key.Name)
	}

	ctx := t.Context()

	applyOperation := func(backend resource.StorageBackend) func(BackendOperation) (any, error) {
		rvs := make(map[string]int64)
		return func(op BackendOperation) (any, error) {
			switch op.fn {
			case WriteEventFn:
				key := op.args[0].(*resourcepb.ResourceKey)
				eventType := op.args[1].(resourcepb.WatchEvent_Type)
				id := resourceID(key)

				rv, err := WriteEvent(ctx, backend, key.Name, eventType,
					WithNamespaceAndRV(key.Namespace, rvs[id]),
					WithResource(key.Resource),
				)
				if err == nil {
					if eventType == resourcepb.WatchEvent_DELETED {
						delete(rvs, id)
					} else {
						rvs[id] = rv
					}
				}
				return nil, err

			case ReadResourceFn:
				resp := backend.ReadResource(ctx, op.args[0].(*resourcepb.ReadRequest))
				if resp != nil {
					resp.ResourceVersion = 0
				}
				return resp, nil

			case ListIteratorFn:
				// TODO
				return nil, nil
			case ListHistoryFn:
				// TODO
				return nil, nil
			case ListModifiedSinceFn:
				// TODO
				return nil, nil

			case GetResourceStatsFn:
				nsr := op.args[0].(resource.NamespacedResource)
				minCount := op.args[1].(int)
				stats, err := backend.GetResourceStats(ctx, nsr, minCount)
				if err == nil {
					for i := range stats {
						stats[i].ResourceVersion = 0
					}
				}
				return stats, err
			}

			require.FailNow(t, "invalid backend operation: %d", op.fn)
			panic("unreachable")
		}
	}

	const (
		numNamespaces    = 10
		numResourceTypes = 3
		group            = "group"
	)

	namespaces := make([]string, numNamespaces)
	for j := range numNamespaces {
		namespaces[j] = fmt.Sprintf("ns%02d", j+1)
	}

	resourceTypes := make([]string, numResourceTypes)
	for j := range numResourceTypes {
		resourceTypes[j] = fmt.Sprintf("resource%02d", j+1)
	}

	var resourceCount int
	newName := func() string {
		resourceCount++
		return fmt.Sprintf("name_%d", resourceCount)
	}

	randomKey := func(rng *rand.Rand) *resourcepb.ResourceKey {
		return &resourcepb.ResourceKey{
			Namespace: randomElement(rng, namespaces),
			Group:     group,
			Resource:  randomElement(rng, resourceTypes),
			Name:      newName(),
		}
	}

	var createdKeys []*resourcepb.ResourceKey

	generator := func(values []reflect.Value, rng *rand.Rand) {
		possibleFns := []BackendFn{WriteEventFn}
		if len(createdKeys) > 0 {
			possibleFns = append(possibleFns, ReadResourceFn, GetResourceStatsFn)
		}

		switch possibleFns[rng.Intn(len(possibleFns))] {
		case WriteEventFn:
			var eventType resourcepb.WatchEvent_Type
			var key *resourcepb.ResourceKey

			if len(createdKeys) == 0 {
				eventType = resourcepb.WatchEvent_ADDED
				key = randomKey(rng)
			} else {
				eventType = randomElement(rng, []resourcepb.WatchEvent_Type{
					resourcepb.WatchEvent_ADDED, resourcepb.WatchEvent_MODIFIED, resourcepb.WatchEvent_DELETED,
				})
				if eventType == resourcepb.WatchEvent_ADDED {
					key = randomKey(rng)
				} else {
					key = randomElement(rng, createdKeys)
				}
			}

			switch eventType {
			case resourcepb.WatchEvent_ADDED:
				createdKeys = append(createdKeys, key)
			case resourcepb.WatchEvent_DELETED:
				for i, k := range createdKeys {
					if k == key {
						createdKeys = append(createdKeys[:i], createdKeys[i+1:]...)
						break
					}
				}
			}

			values[0] = reflect.ValueOf(BackendOperation{fn: WriteEventFn, args: []any{key, eventType}})

		case ReadResourceFn:
			key := randomElement(rng, createdKeys)
			values[0] = reflect.ValueOf(BackendOperation{
				fn:   ReadResourceFn,
				args: []any{&resourcepb.ReadRequest{Key: key}},
			})

		case ListIteratorFn:
			// TODO
		case ListHistoryFn:
			// TODO
		case ListModifiedSinceFn:
			// TODO

		case GetResourceStatsFn:
			ns := randomElement(rng, namespaces)
			values[0] = reflect.ValueOf(BackendOperation{
				fn: GetResourceStatsFn,
				args: []any{
					resource.NamespacedResource{
						Namespace: ns,
						Group:     group,
						Resource:  randomElement(rng, resourceTypes),
					},
					0,
				},
			})
		}
	}

	require.NoError(t, quick.CheckEqual(
		applyOperation(badgerBackend),
		applyOperation(sqlKVBackend),
		&quick.Config{
			MaxCount: 10000,
			Rand:     rng,
			Values:   generator,
		},
	), "reproduce this failure by running with %s=%d", seedEnvVar, seed)
}

func randomElement[T any](rng *rand.Rand, arr []T) T {
	return arr[rng.Intn(len(arr))]
}
