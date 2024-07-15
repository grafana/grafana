---
aliases:
  - ../../troubleshooting/diagnostics/
  - ../enable-diagnostics/
description: Learn how to configure profiling and tracing so that you can troubleshoot Grafana.
keywords:
  - grafana
  - troubleshooting
  - documentation
  - guide
labels:
  products:
    - enterprise
    - oss
menuTitle: Configure profiling and tracing
title: Configure profiling and tracing to troubleshoot Grafana
weight: 200
---

# Configure profiling and tracing to troubleshoot Grafana

You can set up the `grafana-server` process to enable certain diagnostics when it starts. This can be useful
when investigating certain performance problems. It's _not_ recommended to have these enabled by default.

## Turn on profiling and collect profiles

The `grafana-server` can be started with the command-line option `-profile` to enable profiling, `-profile-addr` to override the default HTTP address (`localhost`), and
`-profile-port` to override the default HTTP port (`6060`) where the `pprof` debugging endpoints are available. Further, [`-profile-block-rate`](https://pkg.go.dev/runtime#SetBlockProfileRate) controls the fraction of goroutine blocking events that are reported in the blocking profile, default `1` (i.e. track every event) for backward compatibility reasons, and [`-profile-mutex-rate`](https://pkg.go.dev/runtime#SetMutexProfileFraction) controls the fraction of mutex contention events that are reported in the mutex profile, default `0` (i.e. track no events). The higher the fraction (that is, the smaller this value) the more overhead it adds to normal operations.

Running Grafana with profiling enabled and without block and mutex profiling enabled should only add a fraction of overhead and is suitable for [continuous profiling](https://grafana.com/oss/pyroscope/). Adding a small fraction of block and mutex profiling, such as 10-5 (10%-20%) should in general be fine.

Enable profiling:

```bash
./grafana server -profile -profile-addr=0.0.0.0 -profile-port=8080
```

Enable profiling with block and mutex profiling enabled with a fraction of 20%:

```bash
./grafana server -profile -profile-addr=0.0.0.0 -profile-port=8080 -profile-block-rate=5 -profile-mutex-rate=5
```

Note that `pprof` debugging endpoints are served on a different port than the Grafana HTTP server. Check what debugging endpoints are available by browsing `http://<profile-addr><profile-port>/debug/pprof`.

There are some additional [godeltaprof](https://github.com/grafana/pyroscope-go/tree/main/godeltaprof) endpoints available which are more suitable in a continuous profiling scenario. These endpoints are `/debug/pprof/delta_heap`, `/debug/pprof/delta_block`, `/debug/pprof/delta_mutex`.

You can configure or override profiling settings using environment variables:

```bash
export GF_DIAGNOSTICS_PROFILING_ENABLED=true
export GF_DIAGNOSTICS_PROFILING_ADDR=0.0.0.0
export GF_DIAGNOSTICS_PROFILING_PORT=8080
export GF_DIAGNOSTICS_PROFILING_BLOCK_RATE=5
export GF_DIAGNOSTICS_PROFILING_MUTEX_RATE=5
```

In general, you use the [Go command pprof](https://golang.org/cmd/pprof/) to both collect and analyze profiling data. You can also use [curl](https://curl.se/) or similar to collect profiles which could be convenient in environments where you don't have the Go/pprof command available. Next, some usage examples of using curl and pprof to collect and analyze memory and CPU profiles.

**Analyzing high memory usage/memory leaks:**

When experiencing high memory usage or potential memory leaks it's useful to collect several heap profiles and later when analyzing, compare them. It's a good idea to wait some time, e.g. 30 seconds, between collecting each profile to allow memory consumption to increase.

```bash
curl http://<profile-addr>:<profile-port>/debug/pprof/heap > heap1.pprof
sleep 30
curl http://<profile-addr>:<profile-port>/debug/pprof/heap > heap2.pprof
```

You can then use pprof tool to compare two heap profiles:

```bash
go tool pprof -http=localhost:8081 --base heap1.pprof heap2.pprof
```

**Analyzing high CPU usage:**

When experiencing high CPU usage it's suggested to collect CPU profiles over a period of time, e.g. 30 seconds.

```bash
curl 'http://<profile-addr>:<profile-port>/debug/pprof/profile?seconds=30' > profile.pprof
```

You can then use pprof tool to analyze the collected CPU profile:

```bash
go tool pprof -http=localhost:8081 profile.pprof
```

## Use tracing

The `grafana-server` can be started with the arguments `-tracing` to enable tracing and `-tracing-file` to override the default trace file (`trace.out`) where trace result is written to. For example:

```bash
./grafana server -tracing -tracing-file=/tmp/trace.out
```

You can configure or override profiling settings using environment variables:

```bash
export GF_DIAGNOSTICS_TRACING_ENABLED=true
export GF_DIAGNOSTICS_TRACING_FILE=/tmp/trace.out
```

View the trace in a web browser (Go required to be installed):

```bash
go tool trace <trace file>
2019/11/24 22:20:42 Parsing trace...
2019/11/24 22:20:42 Splitting trace...
2019/11/24 22:20:42 Opening browser. Trace viewer is listening on http://127.0.0.1:39735
```

For more information about how to analyze trace files, refer to [Go command trace](https://golang.org/cmd/trace/).
