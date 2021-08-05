package influxdb

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/tsdb/influxdb/models"
	"github.com/stretchr/testify/require"
)

func TestInfluxdbQueryParser_Parse(t *testing.T) {
	parser := &InfluxdbQueryParser{}
	dsInfo := &models.DatasourceInfo{}

	t.Run("can parse influxdb json model", func(t *testing.T) {
		json := `
        {
        "groupBy": [
          {
            "params": [
              "$interval"
            ],
            "type": "time"
          },
          {
            "params": [
              "datacenter"
            ],
            "type": "tag"
          },
          {
            "params": [
              "none"
            ],
            "type": "fill"
          }
        ],
        "measurement": "logins.count",
        "tz": "Europe/Paris",
        "policy": "default",
        "refId": "B",
        "resultFormat": "time_series",
        "select": [
          [
            {
              "type": "field",
              "params": [
                "value"
              ]
            },
            {
              "type": "count",
              "params": []
            }
          ],
          [
            {
              "type": "field",
              "params": [
                "value"
              ]
            },
            {
              "type": "bottom",
              "params": [
                3
              ]
            }
          ],
          [
            {
              "type": "field",
              "params": [
                "value"
              ]
            },
            {
              "type": "mean",
              "params": []
            },
            {
              "type": "math",
              "params": [
                " / 100"
              ]
            }
          ]
        ],
        "alias": "series alias",
        "tags": [
          {
            "key": "datacenter",
            "operator": "=",
            "value": "America"
          },
          {
            "condition": "OR",
            "key": "hostname",
            "operator": "=",
            "value": "server1"
          }
        ]
      }
      `
		dsInfo.TimeInterval = ">20s"

		query := backend.DataQuery{
			JSON: []byte(json),
		}

		res, err := parser.Parse(query, dsInfo)
		require.NoError(t, err)
		require.Len(t, res.GroupBy, 3)
		require.Len(t, res.Selects, 3)
		require.Len(t, res.Tags, 2)
		require.Equal(t, "Europe/Paris", res.Tz)
		require.Equal(t, time.Second*20, res.Interval)
		require.Equal(t, "series alias", res.Alias)
	})

	t.Run("can parse raw query json model", func(t *testing.T) {
		json := `
      {
        "groupBy": [
          {
            "params": [
              "$interval"
            ],
            "type": "time"
          },
          {
            "params": [
              "null"
            ],
            "type": "fill"
          }
        ],
        "interval": ">10s",
        "policy": "default",
        "query": "RawDummyQuery",
        "rawQuery": true,
        "refId": "A",
        "resultFormat": "time_series",
        "select": [
          [
            {
              "params": [
                "value"
              ],
              "type": "field"
            },
            {
              "params": [

              ],
              "type": "mean"
            }
          ]
        ],
        "tags": [

        ]
      }
      `

		query := backend.DataQuery{
			JSON: []byte(json),
		}

		res, err := parser.Parse(query, dsInfo)
		require.NoError(t, err)
		require.Equal(t, "RawDummyQuery", res.RawQuery)
		require.Len(t, res.GroupBy, 2)
		require.Len(t, res.Selects, 1)
		require.Empty(t, res.Tags)
		require.Equal(t, time.Second*10, res.Interval)
	})

	t.Run("accepts DataQuery.Interval", func(t *testing.T) {
		json := `
        {
        "groupBy": [
          {
            "params": [
              "$interval"
            ],
            "type": "time"
          },
          {
            "params": [
              "datacenter"
            ],
            "type": "tag"
          },
          {
            "params": [
              "none"
            ],
            "type": "fill"
          }
        ],
        "measurement": "logins.count",
        "tz": "Europe/Paris",
        "policy": "default",
        "refId": "B",
        "resultFormat": "time_series",
        "select": [
          [
            {
              "type": "field",
              "params": [
                "value"
              ]
            },
            {
              "type": "count",
              "params": []
            }
          ],
          [
            {
              "type": "field",
              "params": [
                "value"
              ]
            },
            {
              "type": "bottom",
              "params": [
                3
              ]
            }
          ],
          [
            {
              "type": "field",
              "params": [
                "value"
              ]
            },
            {
              "type": "mean",
              "params": []
            },
            {
              "type": "math",
              "params": [
                " / 100"
              ]
            }
          ]
        ],
        "alias": "series alias",
        "tags": [
          {
            "key": "datacenter",
            "operator": "=",
            "value": "America"
          },
          {
            "condition": "OR",
            "key": "hostname",
            "operator": "=",
            "value": "server1"
          }
        ]
      }
      `
		dsInfo.TimeInterval = ">20s"

		query := backend.DataQuery{
			JSON:     []byte(json),
			Interval: time.Second * 5,
		}

		res, err := parser.Parse(query, dsInfo)
		require.NoError(t, err)
		require.Equal(t, time.Second*5, res.Interval)
	})
}
