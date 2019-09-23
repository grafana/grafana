# Grafana Plugin SDK for Go

Develop Grafana backend plugins with this Go SDK.

## Usage

```go
package main

import (
	"context"
	"log"
	"os"

	gf "github.com/grafana/grafana-plugin-sdk-go"
)

const pluginID = "myorg-custom-datasource"

type MyDatasource struct {
	logger *log.Logger
}

func (d *MyDatasource) Query(ctx context.Context, tr gf.TimeRange, ds gf.DatasourceInfo, queries []gf.Query) ([]gf.QueryResult, error) {
	return []gf.QueryResult{}, nil
}

func main() {
	logger := log.New(os.Stderr, "", 0)

	srv := gf.NewServer()

	srv.HandleDatasource(pluginID, &MyDatasource{
		logger: logger,
	})

	if err := srv.Serve(); err != nil {
		logger.Fatal(err)
	}
}
```

## Developing

Generate Go code for Protobuf definitions:

```
make build-proto
```
