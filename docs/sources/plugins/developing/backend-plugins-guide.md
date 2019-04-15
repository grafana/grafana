+++
title = "Developing Backend Plugins"
keywords = ["grafana", "plugins", "backend-plugins", "documentation"]
type = "docs"
[menu.docs]
name = "Developing Backend Plugins"
parent = "developing"
weight = 5
+++

# Backend plugins

Backend plugin is a new type of plugin in Grafana. Once Grafana introduced an alerting feature, external plugins need a backend component that the Grafana server can query for evaluating alert rules. So the main purpose and motivation for backend plugins is alerting. But this new plugin type can be used for achieving different goals such as queries cache, proxy, custom authentication methods and others.

## General information
Backend plugin feature implemented with [HashiCorp plugin system](https://github.com/hashicorp/go-plugin) which is a is a Go plugin system over RPC. Grafana server is launching plugin as a subprocesses and communicating over RPC. This approach has a number of benefits from Grafana perspective:

- Plugins can't crash your grafana process: a panic in a plugin doesn't panic the server.
- Plugins are easy to develop: just write a Go application and go build (or use any other language which supports gRPC).
- Plugins can be relatively secure: The plugin only has access to the interfaces and args given to it, not to the entire memory space of the process.

## Plugin interface

Plugin interface is very simple and described as a Go interface type in [Grafana](https://github.com/grafana/grafana/blob/6724aaeff9a332dc73b4ee0f8abe0621f7253142/pkg/tsdb/query_endpoint.go#L10-L12) and as a general [RPC service](https://github.com/grafana/grafana-plugin-model/blob/84176c64269d8060f99e750ee8aba6f062753336/datasource.proto#L96-L98) in corresponding `.proto` (protocol buffer file):

```go
type TsdbQueryEndpoint interface {
  Query(ctx context.Context, ds *models.DataSource, query *TsdbQuery) (*Response, error)
}
```

```protobuf
service DatasourcePlugin {
  rpc Query(DatasourceRequest) returns (DatasourceResponse);
}
```

Thus, datasource plugin should only implement `Query()` method.

## Introduction to building a backend component for a plugin

[Simple JSON backend](https://github.com/grafana/simple-json-backend-datasource) datasource is a good example for writing simple backend plugin in golang. Let's take a look at some key points.

### Metadata

The plugin needs to know it has a backend component, this is done in the `plugin.json` file by setting two fields: `backend` and `executable`. If you want to enable alerting for your datasource, set `alerting` field to `true` as well.

```json
{
  "id": "grafana-simple-json-backend-datasource",
  "name": "Simple Json backend",
  "type": "datasource",

  "metrics": true,
  "annotations": true,
  "backend": true,
  "alerting": true,
  "executable": "simple-json-plugin",
...
```

`executable` should be the the the first part of the binary filename. The actual binary filename has 3 possible endings:
- _linux_amd64
- _darwin_amd64
- _windows_amd64.exe

When Grafana loads the plugin binary, it use the executable field plus the current OS to load in the correct version of the plugin. So in Simple JSON the executable field is `simple-json-plugin` and the 3 binaries are named:
- `simple-json-plugin_darwin_amd64`
- `simple-json-plugin_linux_amd64`
- `simple-json-plugin_windows_amd64.exe`

So resulting directory will look like this:

```text
simple-json-backend-datasource/
|-- dist/
|   |-- partials/
|   |-- module.js
|   |-- plugin.json
|   |-- simple-json-plugin_linux_amd64
|   |-- simple-json-plugin_darwin_amd64
|   |-- simple-json-plugin_windows_amd64.exe
...
```

### Plugin code

A `pkg/` directory contains three `.go` files:

- `plugin.go` - an entry point of the plugin. This file would be very similar for your datasource - just need to change some details like the plugin name etc.
- `datasource.go` - contains `Query()` method implementation and other plugin logic.
- `models.go` - types for request and response specific to your datasource.

The datasource type is declared in [`datasource.go`](https://github.com/grafana/simple-json-backend-datasource/blob/7927ff0db60c3402dbf954a454f19d7230e18deb/pkg/datasource.go#L21-L24):

```go
package main

import (
  plugin "github.com/hashicorp/go-plugin"
)

type JsonDatasource struct {
  plugin.NetRPCUnsupportedPlugin
}
```

The only requirement for the plugin type is that it should extend `plugin.NetRPCUnsupportedPlugin`. You can include more fields into your struct if you want to add some datasource-specific features, like logging, cache etc:

```go
type JsonDatasource struct {
  plugin.NetRPCUnsupportedPlugin
  logger hclog.Logger
}
```

The main method you should implement is the [`Query()`](https://github.com/grafana/simple-json-backend-datasource/blob/7927ff0db60c3402dbf954a454f19d7230e18deb/pkg/datasource.go#L26):

```go
func (t *JsonDatasource) Query(ctx context.Context, tsdbReq *datasource.DatasourceRequest) (*datasource.DatasourceResponse, error) {
...
```

#### Request format

In order to call this method from the [frontend part](https://github.com/grafana/simple-json-backend-datasource/blob/7927ff0db60c3402dbf954a454f19d7230e18deb/src/datasource.ts#L116), use `/api/tsdb/query` endpoint:

```js
class SimpleJSONDatasource {
  ...

  doTsdbRequest(options) {
    const tsdbRequest = {
      from: options.range.from.valueOf().toString(),
      to: options.range.to.valueOf().toString(),
      queries: options.targets,
    };

    return this.backendSrv.datasourceRequest({
      url: '/api/tsdb/query',
      method: 'POST',
      data: tsdbRequest
    });
  }
}
```

This endpoint gets data in the following format (see [pkg/api/metrics.go](https://github.com/grafana/grafana/blob/7b63913dc1d79da07f0329cf19dc4c2704ec488f/pkg/api/metrics.go#L16) and [pkg/api/dtos/models.go](https://github.com/grafana/grafana/blob/7b63913dc1d79da07f0329cf19dc4c2704ec488f/pkg/api/dtos/models.go#L43-L47)):

```js
{
  from: "1555324640782",  // Optional, time range from
  to: "1555328240782",    // Optional, time range to
  queries: [
    {
      datasourceId: 42,   // Required
      refId: "A",         // Optional, default is "A"
      maxDataPoints: 100, // Optional, default is 100
      intervalMs: 1000,   // Optional, default is 1000

      myFieldFoo: "bar",  // Any other fields,
      myFieldBar: "baz",  // defined by user
      ...
    },
    ...
  ]
}
```

There is only one query function but it is possible to move all your queries to the backend. In order to achieve this, you could add a kind of `queryType` field to your query model and check this type in the backend code. The Stackdriver and Cloudwatch core plugins have examples of supporting multiple types of queries if you need/want to do this:

- Stackdriver: [pkg/tsdb/stackdriver/stackdriver.go](https://github.com/grafana/grafana/blob/6724aaeff9a332dc73b4ee0f8abe0621f7253142/pkg/tsdb/stackdriver/stackdriver.go#L75-L88)
- Cloudwatch: [pkg/tsdb/cloudwatch/cloudwatch.go](https://github.com/grafana/grafana/blob/7b63913dc1d79da07f0329cf19dc4c2704ec488f/pkg/tsdb/cloudwatch/cloudwatch.go#L62-L74)

#### Response format

Go types for the query response can be found in Grafana tsdb models ([pkg/tsdb/models.go](https://github.com/grafana/grafana/blob/7b63913dc1d79da07f0329cf19dc4c2704ec488f/pkg/tsdb/models.go#L22-L34)) or in the corresponding protocol buffer file ([datasource.proto](https://github.com/grafana/grafana-plugin-model/blob/84176c64269d8060f99e750ee8aba6f062753336/datasource.proto#L26-L36))

```protobuf
// datasource.proto

message DatasourceResponse {
  repeated QueryResult results = 1;
}

message QueryResult {
  string error = 1;
  string refId = 2;
  string metaJson = 3;
  repeated TimeSeries series = 4;
  repeated Table tables = 5;
}
```
```go
// pkg/tsdb/models.go

type Response struct {
  Results map[string]*QueryResult `json:"results"`
  Message string                  `json:"message,omitempty"`
}

type QueryResult struct {
  Error       error            `json:"-"`
  ErrorString string           `json:"error,omitempty"`
  RefId       string           `json:"refId"`
  Meta        *simplejson.Json `json:"meta,omitempty"`
  Series      TimeSeriesSlice  `json:"series"`
  Tables      []*Table         `json:"tables"`
}
```

Resulting JSON response which frontend will receive looks like this:

```js
results: {
  A: {
    refId: "A",
    series: [
      { name: "series_1", points: [...] },
      { name: "series_2", points: [...] },
      ...
    ],
    tables: null,
    // Request metadata (any arbitrary JSON).
    // Optional, empty field will be omitted.
    meta: {},
    // Error message. Optional, empty field will be omitted.
    error: "Request failed",
  }
}
```

### Logging

Logs from the plugin will be automatically sent to the Grafana server and will appear in its log flow. Grafana server reads logs from plugins `stderr` stream, so with the standard `log` package you have to set output to `os.Stderr` first:

```go
func main() {
  log.SetOutput(os.Stderr)
  log.Println("from plugin!")
  ...
}
```

Another option for logging - using [go-hclog](https://github.com/hashicorp/go-hclog) package:

```go
package main

import (
  hclog "github.com/hashicorp/go-hclog"
)

var pluginLogger = hclog.New(&hclog.LoggerOptions{
  Name:  "simple-json-backend-datasource",
  Level: hclog.LevelFromString("DEBUG"),
})

func main() {
  pluginLogger.Debug("Running Simple JSON backend datasource")
  ...
}
```

### Building the backend binary

Building the binary depends on which OS you are using. For a Linux distro, the build command would be:

```sh
go build -o ./dist/simple-json-plugin_linux_amd64 ./pkg
```

Restart your Grafana server and then check the Grafana logs to make sure your plugin is loaded properly.
