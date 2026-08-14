# Benchmarking secrets consolidation

The `Consolidate` method re-encrypts all encrypted values in the database. To measure **duration**, **memory**, and **bottlenecks** against a running Grafana data set (e.g. SQLite with seeded secure values), use the CLI with profiling flags.

**Note:** Consolidation is only invoked via **grafana-cli** (not the HTTP server). The same `Consolidate` code and dependencies run in the CLI process against your config and database. For benchmarking, use the same config/DB as your server and stop the server (or use a copy of the DB) so the CLI can open the DB.

## 1. Duration and high-sample-rate CPU profile

```bash
# Same config/DB as your running Grafana (stop the server or use a DB copy).
# Pass --config and --homepath either after "cli" or after "consolidate":
./grafana cli admin secrets-consolidation consolidate \
  --config /path/to/grafana.ini \
  --homepath /path/to/grafana \
  --benchmark \
  --cpuprofile=cpu.out \
  --cpu-profile-rate=10000
```

- **Duration:** Printed at the end (`duration_sec`, `duration`).
- **High sample rate:** `--cpu-profile-rate=10000` (samples/sec). Increase (e.g. 20000) for finer bottleneck resolution; default is 5000.
- **CPU profile:** `cpu.out` can be analyzed with:
  ```bash
  go tool pprof -http=:8080 cpu.out
  ```
  Use “Top”, “Flame Graph”, or “Source” to find hotspots.

## 2. Memory (heap) profile

```bash
./grafana cli admin secrets-consolidation consolidate \
  --config /path/to/grafana.ini \
  --homepath /path/to/grafana \
  --benchmark \
  --memprofile=mem.out
```

- **Heap profile:** Written after consolidation finishes (includes a GC before writing). Open with:
  ```bash
  go tool pprof -http=:8080 mem.out
  ```

## 3. Combined: duration + CPU + memory

```bash
./grafana cli admin secrets-consolidation consolidate \
  --config /path/to/grafana.ini \
  --homepath /path/to/grafana \
  --benchmark \
  --cpuprofile=cpu.out \
  --memprofile=mem.out \
  --cpu-profile-rate=10000
```

## 4. Execution trace (timeline and bottlenecks)

For a timeline of goroutines, GC, and blocking, use the **execution trace** (not pprof). Build and run with trace enabled:

```bash
# Build
go build -o grafana-cli ./pkg/cmd/grafana-cli

# Run with trace (writes trace.out; open with go tool trace trace.out)
GODEBUG=trace=trace.out ./grafana cli admin secrets-consolidation consolidate \
  --config /path/to/grafana.ini \
  --homepath /path/to/grafana \
  --benchmark
```

Then:

```bash
go tool trace trace.out
```

Use “View trace” to see where time is spent and find bottlenecks.

## Flags reference

| Flag | Purpose |
|------|--------|
| `--config` | Path to config file (e.g. custom.ini). Can appear after `cli` or after `consolidate`. |
| `--homepath` | Grafana home path. Can appear after `cli` or after `consolidate`. |
| `--benchmark` | Print duration and set CPU profile rate (when used with `--cpuprofile`) |
| `--cpuprofile=<file>` | Write CPU profile to file during consolidation |
| `--memprofile=<file>` | Write heap profile to file after consolidation |
| `--cpu-profile-rate=<n>` | CPU samples per second (default 5000; use 10000+ for high sample rate) |

## Quick duration-only run

```bash
./grafana cli admin secrets-consolidation consolidate \
  --config /path/to/grafana.ini \
  --homepath /path/to/grafana \
  --benchmark
```

Output includes `duration_sec` and `duration` (e.g. `2m3.456s`).
