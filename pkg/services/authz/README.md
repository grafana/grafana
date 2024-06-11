# Authorization

This package contains the authorization server implementation.

## Configuration

To configure the authorization server and client, use the "authorization" section of the configuration ini file.

The `address` setting, specifies the address where the authorization server is located (ex: `server.example.org:10000`). 

The `mode` setting can be set to either `grpc` or `inproc`. When set to `grpc`, the client will connect to the specified address. When set to `inproc` the client will use inprocgrpc (relying on go channels) to wrap a local instantiation of the server. 

The `listen` setting determines whether the authorization server should listen for incoming requests. When set to `true`, the authorization service will be registered to the Grafana grpc server.

### Example

Here is an example to connect the authorization client to a remote grpc server.

```ini
[authorization]
address = "server.example.org:10000"
mode = "grpc"
listen = false
```

Here is an example to use inprocgrpc to run the authorization server in "embedded" mode.

```ini
[authorization]
mode = "inproc"
listen = false
```