# Authorization

This package contains the authorization server implementation.

## Feature toggles

The following feature toggles need to be activated:

```ini
[feature_toggles]
authZGRPCServer = true
grpcServer = true
```

## Configuration

To configure the authorization server and client, use the "authorization" section of the configuration ini file.

The `remote_address` setting, specifies the address where the authorization server is located (ex: `server.example.org:10000`). 

The `mode` setting can be set to either `cloud`, `grpc` or `inproc`. When set to `cloud` (or `grpc`), the client will connect to the specified address. When set to `inproc` the client will use inprocgrpc (relying on go channels) to wrap a local instantiation of the server. 

The `listen` setting determines whether the authorization server should listen for incoming requests. When set to `true`, the authorization service will be registered to the Grafana GRPC server.

The default configuration does not register the authorization service on the Grafana GRPC server and binds the client to it `inproc`:

```ini
[authorization]
remote_address = ""
listen = false
mode = "inproc"
```

### Example

Here is an example to connect the authorization client to a remote grpc server.

```ini
[authorization]
remote_address = "server.example.org:10000"
listen = false
mode = "grpc"
```

Here is an example to register the authorization service on the Grafana GRPC server and connect the client to it through grpc.

```ini
app_mode = development

[authorization]
remote_address = "localhost:10000"
listen = true
mode = "grpc"
```

Here is an example to connect the authorization client to a remote grpc server and use access token authentication.
```ini
[environment]
stack_id = 11

[authorization]
remote_address = "server.example.org:10000"
mode = "cloud"
listen = false

[grpc_client_authentication]
token = "ReplaceWithToken"
token_exchange_url = "signing-server.example.org/path/to/signing"
token_namespace = "stacks-11"
```