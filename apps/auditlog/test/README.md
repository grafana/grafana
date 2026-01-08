# Audit Log Integration Test

This folder contains an integration test setup that demonstrates the full audit log pipeline:

1. **Log Emitter** - A Go application that generates test logs (both audit and regular)
2. **Grafana Alloy** - Receives OTLP logs, filters for `audit=true`, and forwards to the audit log server
3. **Audit Log Server** - Receives and processes the filtered audit logs

## Architecture

```
┌──────────────┐     OTLP/gRPC      ┌─────────────────┐     OTLP/HTTP     ┌─────────────────┐
│ Log Emitter  │ ──────────────────▶│  Grafana Alloy  │ ──────────────────▶│  Audit Log Svc  │
│              │   :4317            │                 │                    │                 │
│ (Go app)     │                    │ Filter:         │   :8080/auditlog   │ (Go server)     │
│              │                    │ audit=true      │                    │                 │
└──────────────┘                    └─────────────────┘                    └─────────────────┘
```

## Prerequisites

- Docker and Docker Compose
- Go 1.25+

## Running the test

### 1. Start the infrastructure

```sh
docker compose up -d
```

This starts:
- Alloy on ports 4317 (gRPC), 4318 (HTTP), 12345 (UI)
- Audit log server on port 8080

### 2. Build and run the log emitter

Using the Makefile (recommended):

```sh
make run-emitter
```

Or manually (note: `GOWORK=off` is required when inside the grafana monorepo):

```sh
cd logemitter
GOWORK=off go build -o logemitter .
./logemitter -endpoint localhost:4317 -interval 1000 -audit-ratio 0.3
```

### 3. Observe the logs

Watch the audit log server output:

```sh
docker compose logs -f auditlog
```

You should see only the audit logs (those with `audit=true`) being received by the audit log server, while regular logs are filtered out by Alloy.

### 4. Access Alloy UI

Open http://localhost:12345 to view the Alloy UI and monitor the pipeline.

## Log Emitter options

| Flag | Default | Description |
|------|---------|-------------|
| `-endpoint` | `localhost:4317` | OTLP gRPC endpoint |
| `-interval` | `1000` | Interval between logs in milliseconds |
| `-audit-ratio` | `0.3` | Ratio of audit logs (0.0 to 1.0) |
| `-service` | `test-app` | Service name for logs |
| `-insecure` | `true` | Use insecure connection |

## Alloy configuration

The Alloy configuration (`alloy-config.alloy`) does the following:

1. **Receives** OTLP logs via gRPC (port 4317) and HTTP (port 4318)
2. **Filters** logs using the `otelcol.processor.filter` component, keeping only logs with `audit=true`
3. **Exports** filtered logs to the audit log server via OTLP HTTP

## Cleanup

```sh
docker compose down -v
```

## Troubleshooting

### Logs not appearing in the audit log server

1. Check Alloy logs: `docker compose logs alloy`
2. Verify the log emitter is sending to the correct endpoint
3. Ensure logs have the `audit=true` attribute set

### Connection refused errors

1. Ensure Docker Compose is running: `docker compose ps`
2. Check that ports are not in use by other services
3. Wait a few seconds for services to start up

