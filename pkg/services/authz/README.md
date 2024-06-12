# Authorization

This package contains the authorization server implementation.

## Configuration

To configure the authorization server and client, use the "authorization" section of the configuration ini file.

The `address` setting, specifies the address where the authorization server is located (ex: `server.example.org:10000`). 

The `mode` setting can be set to either `grpc` or `inproc`. When set to `grpc`, the client will connect to the specified address. When set to `inproc` the client will use inprocgrpc (relying on go channels) to wrap a local instantiation of the server. 

The `listen` setting determines whether the authorization server should listen for incoming requests. When set to `true`, the authorization service will be registered to the Grafana grpc server.

The default configuration does not open the authorization server port for listening and binds the client to it `inproc`:
```ini
[authorization]
address = ""
listen = false
mode = "inproc"
```

### Example

Here is an example to connect the authorization client to a remote grpc server.

```ini
[authorization]
address = "server.example.org:10000"
mode = "grpc"
```

Here is an example to run the authorization server locally and connect the client to it through grpc

```ini
[authorization]
address = "localhost:10000"
listen = true
mode = "grpc"
```
