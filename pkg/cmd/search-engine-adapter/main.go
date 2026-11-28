// search-engine-adapter runs the Elasticsearch search adapter prototype.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/searchadapter/elasticsearch"
)

func main() {
	var opts elasticsearch.ElasticsearchAdapterOptions
	listen := flag.String("listen", "127.0.0.1:9098", "gRPC listen address")
	allowInsecure := flag.Bool("allow-insecure-listen", false, "allow plaintext gRPC off loopback for isolated development only")
	flag.StringVar(&opts.Endpoint, "elasticsearch", "http://127.0.0.1:9200", "Elasticsearch HTTP origin")
	flag.StringVar(&opts.Index, "index", "", "configured Elasticsearch index")
	flag.StringVar(&opts.Key.Namespace, "namespace", "default", "Grafana namespace")
	flag.StringVar(&opts.Key.Group, "group", "dashboard.grafana.app", "Grafana API group")
	flag.StringVar(&opts.Key.Resource, "resource", "dashboards", "Grafana resource")
	flag.StringVar(&opts.Generation, "generation", "local", "logical index generation")
	flag.StringVar(&opts.SchemaRevision, "schema-revision", "", "logical field schema revision (defaults to the Grafana field schema hash)")
	flag.Parse()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	if err := run(ctx, *listen, opts, *allowInsecure); err != nil {
		log.Print(err)
		os.Exit(1)
	}
}

func run(ctx context.Context, address string, opts elasticsearch.ElasticsearchAdapterOptions, allowInsecure bool) error {
	// Until index creation carries the field declarations, both sides need
	// matching built-in search schemas.
	selectable, hashes, providers, err := resource.SearchFieldsForManifests(resource.MergeManifestsByKind(resource.AppManifests())...)
	if err != nil {
		return err
	}
	registry := resource.NewSearchFieldsRegistry(selectable, hashes, providers)
	selectableFields, hash, provider := registry.ForKey(opts.Key)
	opts.SelectableFields, opts.Fields = selectableFields, provider
	if opts.SchemaRevision == "" {
		opts.SchemaRevision = hash
	}
	addr, err := net.ResolveTCPAddr("tcp", address)
	if err != nil {
		return err
	}
	if !addr.IP.IsLoopback() {
		if !allowInsecure {
			return fmt.Errorf("non-loopback -listen requires -allow-insecure-listen")
		}
		log.Print("WARNING: serving plaintext gRPC; use only on an isolated dev network")
	}
	listener, err := net.ListenTCP("tcp", addr)
	if err != nil {
		return err
	}
	defer func() { _ = listener.Close() }()
	log.Printf("Search engine adapter listening on %s", listener.Addr())
	return elasticsearch.ServeElasticsearchAdapter(ctx, listener, opts, allowInsecure)
}
