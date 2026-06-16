# Usage Stats POC — run & compare (badger over gRPC)

This runs Grafana (enterprise) with unified storage backed by a **standalone
BadgerDB gRPC server**, dual-writes dashboard usage events into it via the new
`RecordEvent` RPC, and lets you compare the badger totals against the legacy
`dashboard_usage_*` SQLite tables.

## What was wired

- **Proto/RPC**: `RecordEvent(RecordEventRequest) -> RecordEventResponse` added to
  `ResourceStore` (`pkg/storage/unified/proto/resource.proto`, regenerated into
  `resourcepb`).
- **Server**: `server.RecordEvent` buffers events into the stats `Ingester`
  (`pkg/storage/unified/resource/server.go`). The ingester + flush/recalc loops
  are wired whenever the backend is KV-backed (`file` or `unified-kv-grpc`) via
  `resource.NewStatsIngesterForBackend`.
- **Client (dual-write)**: enterprise `summaries.WriteEvents` (the path that
  populates `dashboard_usage_*`) now also calls `resourceClient.RecordEvent`
  for each view/query/error event.
- **Inspection**: `cmd/statsdump` reads the stats sections live from the KV
  gRPC server.

## 1. Start the standalone badger KV gRPC server

```bash
cd ~/grafana
go run ./pkg/extensions/storage/unified/kv/example/server.go -port 10000 -data-dir ./data/kvgrpc
```

Leave it running. Badger persists under `./data/kvgrpc/badger`.

## 2. Point Grafana at it

In `conf/custom.ini`:

```ini
[grafana-apiserver]
storage_type = unified-kv-grpc

[unified_storage.kv_grpc]
address = localhost:10000
```

(`localhost:10000` is also the config default, so the second block is optional.)

## 3. Run Grafana (enterprise) + frontend

```bash
make run        # backend, enterprise build
yarn start      # frontend (separate terminal)
```

Usage insights / analytics is a licensed feature — make sure your dev license
enables it, otherwise no `dashboard_usage_*` events are produced and there is
nothing to compare.

## 4. View a dashboard, then compare

Open a dashboard a few times in the browser. Within a couple of seconds the
flush loop writes to badger (look for `flushed usage stats` log lines).

**Read badger (live, over gRPC):**

```bash
go run ./pkg/storage/unified/resource/stats/cmd/statsdump -addr localhost:10000 -section stats/daily
go run ./pkg/storage/unified/resource/stats/cmd/statsdump -addr localhost:10000 -section stats/aggregates
```

Daily keys look like:
`dashboard.grafana.app/dashboards/default/<uid>/2026-06-12/view = 3`

**Read SQLite (legacy):**

```bash
sqlite3 ~/grafana/data/grafana.db \
  "select dashboard_uid, day, views, queries, errors from dashboard_usage_by_day order by day desc;"
```

## Do the totals match?

**Yes — for the per-day buckets**, which is the apples-to-apples comparison:

- `dashboard_usage_by_day.views` for today  ==  badger `stats/daily/.../<today>/view`

Both are driven by the **same** events inside `summaries.WriteEvents`, so we
increment 1:1. Each dashboard view increments both by exactly one.

Caveats (expected, not bugs):

1. **Timing.** Legacy buffers and flushes on its own interval; our flush loop
   runs every 2s. Right after a view the two can briefly differ, then converge.
2. **Aggregates vs per-day.** Compare the **per-day** table, not the rolled-up
   `dashboard_usage_sums`. The legacy `*_sums` table only updates when the
   legacy rollup job runs (startup + `rollupInterval`). Our `stats/aggregates`
   cache is bumped on every flush, so the two aggregate views drift in time even
   though the underlying per-day counts agree.
3. **Lossy by design.** Both sides drop in-memory buffers on crash. On a quiet
   local instance you should see exact agreement on the per-day counts.

## In-process alternative (no gRPC server)

`storage_type = file` uses an in-process badger at
`data/grafana-apiserver/badger`. The ingester is wired the same way, but badger
is locked by Grafana so `statsdump` can't attach — read the badger totals from
the `flushed usage stats` log lines instead.

 Reproduce later

 1. Configure — in conf/custom.ini:

 ```ini
   [grafana-apiserver]
   storage_type = unified-kv-grpc

   [unified_storage.kv_grpc]
   address = localhost:10000

   [analytics.summaries]
   buffer_write_interval = 5s
   buffer_write_timeout = 2s
 ```

 2. Start the standalone badger KV gRPC server (terminal 1):

 ```bash
   cd ~/grafana
   mkdir -p ./data/kvgrpc
   go run ./pkg/extensions/storage/unified/kv/example/server.go -port 10000 -data-dir ./data/kvgrpc
 ```

 3. Build + run Grafana enterprise (terminal 2). Needs data/license.jwt present:

 ```bash
   cd ~/grafana
   go build -tags enterprise -o bin/grafana-ent ./pkg/cmd/grafana
   ./bin/grafana-ent server --homepath="$PWD" --config="$PWD/conf/custom.ini"
 ```

 4. Create a dashboard + issue view events (terminal 3):

 ```bash
   cd ~/grafana
   curl -s -u admin:admin -H "Content-Type: application/json" -X POST http://localhost:3000/api/dashboards/db \
     -d '{"dashboard":{"title":"Stats POC","uid":"statspoc01","panels":[]},"overwrite":true}'

   for i in 1 2 3 4 5; do
     curl -s -u admin:admin -H "Content-Type: application/json" -X POST http://localhost:3000/api/ma/events \
       -d '[{"eventName":"dashboard-view","dashboardUid":"statspoc01"}]'
   done
 ```

 (For query/error metrics instead, use {"eventName":"data-request","dashboardUid":"statspoc01","totalQueries":3}.)

 5. Compare both databases (wait ~10s for buffers to flush):

 ```bash
   # NEW (badger, live over gRPC)
   go run ./pkg/storage/unified/resource/stats/cmd/statsdump -addr localhost:10000 -section stats/daily
   go run ./pkg/storage/unified/resource/stats/cmd/statsdump -addr localhost:10000 -section stats/aggregates

   # LEGACY (SQLite)
   sqlite3 -header -column data/grafana.db \
     "select dashboard_uid, day, views, queries, errors from dashboard_usage_by_day where dashboard_uid='statspoc01';"
 ```

 Cleanup when done:

 ```bash
   # Ctrl-C both servers, then:
   rm -rf ~/grafana/data/kvgrpc
   # revert conf/custom.ini storage_type back to `file`
 ```

