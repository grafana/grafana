# Audit Log Server

An independent HTTP server that receives OpenTelemetry logs from Grafana Alloy agents using the OTLP HTTP exporter.

## Features

- Accepts OTLP logs via HTTP POST at `/auditlog`
- Supports binary protobuf format (`Content-Type: application/x-protobuf`)
- Supports JSON format (`Content-Type: application/json`)
- Handles gzip-compressed requests (`Content-Encoding: gzip`)
- Health check endpoint at `/health`
- Prometheus metrics endpoint at `/metrics`
- Configurable HTTP timeouts and graceful shutdown

## Building

```sh
make build
```

This creates the binary at `bin/auditlog`.

## Running

```sh
make run
```

Or run directly with options:

```sh
./bin/auditlog -port 8080 -log-level debug -shutdown-timeout 60s
```

### Command-line options

- `-port`: HTTP server port (default: `8080`)
- `-log-level`: Log level - debug, info, warn, error (default: `info`)
- `-read-timeout`: HTTP read timeout (default: `15s`)
- `-write-timeout`: HTTP write timeout (default: `30s`)
- `-idle-timeout`: HTTP idle timeout (default: `60s`)
- `-shutdown-timeout`: Graceful shutdown timeout (default: `30s`)

## Alloy configuration

To send logs from Grafana Alloy to this server, configure the `otelcol.exporter.otlphttp` component:

```alloy
otelcol.exporter.otlphttp "auditlog" {
  client {
    endpoint = "http://localhost:8080"
    // For binary protobuf format (more efficient)
    // headers = { "Content-Type" = "application/x-protobuf" }
  }
}
```

The logs endpoint will be available at `http://localhost:8080/auditlog`.

## API

### POST /auditlog

Receives OpenTelemetry logs in OTLP format.

**Request headers:**

| Header | Values | Description |
|--------|--------|-------------|
| `Content-Type` | `application/x-protobuf`, `application/json` | Payload format |
| `Content-Encoding` | `gzip` (optional) | Compression |

**Request body:**

The request body should be an `ExportLogsServiceRequest` message as defined in the [OpenTelemetry Protocol](https://opentelemetry.io/docs/specs/otlp/).

**Response:**

Returns an `ExportLogsServiceResponse` in the same format as the request.

### GET /health

Health check endpoint.

**Response:**

- `200 OK` with body `OK`

### GET /metrics

Prometheus metrics endpoint for observability.

**Response:**

- `200 OK` with Prometheus metrics in text format

## Development

```sh
# Format code
make fmt

# Run linter
make lint

# Run tests
make test

# Clean build artifacts
make clean
```

## Integration testing

The `test/` folder contains a full integration test setup with:

- Docker Compose configuration for Alloy and the audit log server
- Alloy configuration that filters logs with `audit=true`
- A log emitter tool that sends test logs

Refer to [test/README.md](./test/README.md) for details on running the integration tests.

