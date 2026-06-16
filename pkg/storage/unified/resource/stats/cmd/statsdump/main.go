// statsdump connects to a standalone unified-storage KV gRPC server (the one
// from pkg/extensions/storage/unified/kv/example/server.go) and prints the
// usage-stats sections live, so they can be compared against the legacy
// dashboard_usage_* tables in SQLite. (Unified-storage stats POC.)
//
// Usage:
//
//	go run ./pkg/storage/unified/resource/stats/cmd/statsdump -addr localhost:10000
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"log"
	"sort"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	kvgrpc "github.com/grafana/grafana/pkg/extensions/storage/unified/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
)

func main() {
	addr := flag.String("addr", "localhost:10000", "KV gRPC server address")
	section := flag.String("section", "stats/aggregates", "KV section to dump (e.g. stats/aggregates, stats/daily)")
	flag.Parse()

	conn, err := grpc.NewClient(*addr, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("dial %s: %v", *addr, err)
	}
	defer func() { _ = conn.Close() }()

	kv := kvgrpc.NewKVGRPC(conn)
	ctx := context.Background()

	type kvPair struct{ key, val string }
	var pairs []kvPair
	for key, err := range kv.Keys(ctx, *section, resource.ListOptions{}) {
		if err != nil {
			log.Fatalf("listing keys in %s: %v", *section, err)
		}
		r, err := kv.Get(ctx, *section, key)
		if err != nil {
			log.Fatalf("get %s: %v", key, err)
		}
		b, _ := io.ReadAll(r)
		_ = r.Close()
		pairs = append(pairs, kvPair{key, string(b)})
	}

	sort.Slice(pairs, func(i, j int) bool { return pairs[i].key < pairs[j].key })
	fmt.Printf("=== %s (%d keys) ===\n", *section, len(pairs))
	for _, p := range pairs {
		fmt.Printf("%s = %s\n", p.key, p.val)
	}
}
