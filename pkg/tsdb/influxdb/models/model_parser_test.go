package models

import (
	"testing"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

func TestInfluxdbQueryParser_Parse(t *testing.T) {
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
        "limit": "1",
        "slimit": "1",
        "orderByTime": "ASC",
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

		query := backend.DataQuery{
			JSON:     []byte(json),
			Interval: time.Second * 20,
		}

		res, err := QueryParse(query, nil)
		require.NoError(t, err)
		require.Len(t, res.GroupBy, 3)
		require.Len(t, res.Selects, 3)
		require.Len(t, res.Tags, 2)
		require.Equal(t, "Europe/Paris", res.Tz)
		require.Equal(t, "1", res.Limit)
		require.Equal(t, "1", res.Slimit)
		require.Equal(t, "ASC", res.OrderByTime)
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
        "query": "SELECT \"value\" FROM \"measurement\"",
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
			JSON:     []byte(json),
			Interval: time.Second * 10,
		}

		res, err := QueryParse(query, nil)
		require.NoError(t, err)
		require.Equal(t, `SELECT "value" FROM "measurement"`, res.RawQuery)
		require.Len(t, res.GroupBy, 2)
		require.Len(t, res.Selects, 1)
		require.Empty(t, res.Tags)
		require.Equal(t, time.Second*10, res.Interval)
	})

	t.Run("will enforce a minInterval of 1 millisecond", func(t *testing.T) {
		json := `
      {
        "query": "SELECT \"value\" FROM \"measurement\"",
        "rawQuery": true,
        "resultFormat": "time_series"
      }
      `

		query := backend.DataQuery{
			JSON:     []byte(json),
			Interval: time.Millisecond * 0,
		}

		res, err := QueryParse(query, nil)
		require.NoError(t, err)
		require.Equal(t, time.Millisecond*1, res.Interval)
	})
}
