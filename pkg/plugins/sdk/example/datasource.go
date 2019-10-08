package main

import (
	"context"
	"log"
	"os"
	"time"

	gf "github.com/grafana/grafana/pkg/plugins/sdk"
	"github.com/grafana/grafana/pkg/plugins/sdk/dataframe"
)

const pluginID = "myorg-custom-datasource"

type MyDatasource struct {
	logger *log.Logger
}

func (d *MyDatasource) Query(ctx context.Context, tr gf.TimeRange, ds gf.DataSourceInfo, queries []gf.Query) ([]gf.QueryResult, error) {
	return []gf.QueryResult{
		{
			RefID: "A",
			DataFrames: []*dataframe.Frame{
				dataframe.New("http_requests_total", dataframe.Labels{"service": "auth", "env": "prod"},
					dataframe.NewField("timestamp", dataframe.FieldTypeTime, []time.Time{time.Now(), time.Now(), time.Now()}),
					dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{45.0, 49.0, 29.0}),
				),
				dataframe.New("go_goroutines", dataframe.Labels{},
					dataframe.NewField("timestamp", dataframe.FieldTypeTime, []int64{123238426, 123238456, 123238486}),
					dataframe.NewField("value", dataframe.FieldTypeNumber, []float64{45.0, 49.0, 29.0}),
				),
			},
		},
		{
			RefID: "B",
			DataFrames: []*dataframe.Frame{
				dataframe.New("organization", dataframe.Labels{"component": "business"},
					dataframe.NewField("department", dataframe.FieldTypeString, []string{"engineering", "sales"}),
					dataframe.NewField("num_employees", dataframe.FieldTypeNumber, []int64{20, 15}),
				),
			},
		},
	}, nil
}

func main() {
	logger := log.New(os.Stderr, "", 0)

	srv := gf.NewServer()

	srv.HandleDataSource(pluginID, &MyDatasource{
		logger: logger,
	})

	if err := srv.Serve(); err != nil {
		logger.Fatal(err)
	}
}
