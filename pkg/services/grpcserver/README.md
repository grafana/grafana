# grpcserver

The `grpcserver` package provides the implementation of the gRPC server for handling remote procedure calls in Grafana. It enables communication between clients and the Grafana server using the gRPC protocol.

## Structure

- `service.go`: This file contains the main configuration of the gRPC service, which implements the `registry.BackgroundService` interface.
- `interceptors`: This folder contains the middleware functions used for intercepting and modifying gRPC requests and responses.
- `context`: This folder contains helpers related to getting and setting values in `context.Context`.
- `health.go`: This provides the implementation of the gRPC health check service, which is automatically registered with the gRPC server.
- `reflection.go`: This provides the implementation of the gRPC reflection service, which is automatically registered with the gRPC server.

## Usage

Enable the gRPC server in Grafana by setting `enabled = true` in the `grpc_server` section of your `custom.ini` configuration file.

```ini
[grpc_server]
enabled = true
network = "tcp"
address = "127.0.0.1:10000"
use_tls = false
cert_file =
key_file =
# this will log the request and response for each unary gRPC call
enable_logging = false
# Maximum size of a message that can be received in bytes. If not set, defaults to 32 MiB.
max_recv_msg_size =
# Maximum size of a message that can be sent in bytes. If not set, uses the gRPC default (unlimited).
max_send_msg_size =
```

### Blob transport limits

Blob support uses unary `PutBlob` and `GetBlob` calls, which carry the entire payload
in one message. The default server receive limit is 32 MiB. Blob uploads larger than
the gRPC default of 4 MiB require this higher limit on the storage server.

When using a separate unified-storage service, upgrade that service before enabling
large blob uploads, or set `grpc_server.max_recv_msg_size = 33554432` on the existing
service. These settings must be applied to the storage server, not just the Grafana
API server. Explicit server limits still apply.

For payloads approaching or exceeding 32 MiB, increase the receive limit to include
both the blob content and protobuf metadata. If you configure `max_send_msg_size`,
it must also accommodate blob downloads. Clients must use compatible send and
receive limits; the gRPC client receive default is 4 MiB.

### Optional: Connection Management and Load Balancing

These settings help with:

- **Resource management**: Prevent resource leaks from idle connections
- **Connection health**: Detect and clean up dead connections
- **Load balancing**: Force connection recycling for better distribution across multiple server instances
- **DoS protection**: Rate limit keepalive pings from clients

```ini
# Connection management options
# Maximum amount of time a connection may exist before it will be closed
max_connection_age = 300s
# Additional time to allow for pending RPCs to complete before forcibly closing connections
max_connection_age_grace = 10s
# Maximum amount of idle time before a connection is closed
max_connection_idle = 300s
# Frequency of server-to-client pings to check if a connection is still active
keepalive_time = 30s
# Amount of time the server waits for a response to keepalive pings before closing the connection
keepalive_timeout = 5s
# Minimum amount of time a client should wait before sending a keepalive ping
keepalive_min_time = 5s
```

## Example Services

View [health.go] and [reflection.go] for examples of how to implement gRPC services in Grafana. These services are currently initialized by the [background service registry](../../registry/backgroundsvcs/background_services.go).
