# Zanzana

## Zanzana cli
Zanzana can be run as a standalone OpenFGA HTTP server that allows you to use the OpenFGA CLI to debug and manage fine-grained authorization relationships within Grafana.

To test this you need to run standalone zanzana server. Use following config:

```ini
# ini
app_mode = development
target = zanzana-server

[feature_toggles]
zanzana = true

[zanzana.server]
http_addr = 127.0.0.1:8080

[grpc_server]
enabled = true
address = 127.0.0.1:10000
```

And then run grafana server target:

```bash
./bin/darwin-arm64/grafana server target
```

### Using OpenFGA CLI

useful info on how to setup and use https://openfga.dev/docs/getting-started/cli
Once the server is running, you can interact with it using the OpenFGA CLI:

```bash
# List all stores
fga store list

# Other commands
fga model read
fga tuple list
```
