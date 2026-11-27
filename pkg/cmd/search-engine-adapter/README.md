# Elasticsearch search adapter prototype

With a disposable Elasticsearch instance listening at `127.0.0.1:9200`, run from the Grafana repository root:

```bash
go run ./pkg/cmd/search-engine-adapter -index grafana-search-local -generation local-1
```

The adapter listens on `127.0.0.1:9098` and serves the `SearchEngine` gRPC API for dashboards in the `default` namespace. It creates the configured index when a client calls `EnsureIndex`, not at startup. Use a fresh index name and generation for each initial build.

The prototype loads search field declarations from Grafana’s built-in manifests at startup. It does not load custom or updated manifests at runtime. The adapter needs the field types and search capabilities to build its Elasticsearch mapping, not the full manifests. A future version could receive those declarations from Grafana at index creation and use the schema revision on later requests to check that the index matches.

Use `-listen` with `-allow-insecure-listen` to bind beyond loopback. The adapter uses unauthenticated plaintext gRPC; use it only on an isolated development network.

Partial search matches actual substrings. Result order may differ from Bleve.

Starting the adapter does not enable Grafana's remote search backend. Grafana still needs configuration for the adapter endpoint.
