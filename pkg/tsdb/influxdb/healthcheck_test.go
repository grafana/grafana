package influxdb

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/assert"
)

func Test_healthcheck(t *testing.T) {
	t.Run("should do successful health check for version flux ", func(t *testing.T) {
		s := GetMockService(influxVersionFlux, RoundTripper{
			Body: `#datatype,string,long,string,string,string,string,long
#group,false,false,false,false,true,false,false
#default,_result,,,,,,
,result,table,name,id,organizationID,retentionPolicy,retentionPeriod
,,0,_monitoring,effbe6d547e1c085,c678d3a458299f4e,,604800000000000
,,0,_tasks,9ac37d3047b0970c,c678d3a458299f4e,,259200000000000
,,0,mybucket,98184c45c69fc01e,c678d3a458299f4e,,0`,
		})
		res, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{},
			Headers:       nil,
		})
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusOk, res.Status)
	})
	t.Run("should do successful health check for version InfluxQL", func(t *testing.T) {
		s := GetMockService(influxVersionInfluxQL, RoundTripper{
			Body: `{"results": [{"series": [{"columns": ["name"],"name": "measurements","values": [["cpu"],["disk"],["diskio"],["kernel"],["mem"],["processes"],["swap"],["system"]]}],"statement_id": 0}]}`,
		})
		res, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{},
			Headers:       nil,
		})
		assert.NoError(t, err)
		assert.Equal(t, backend.HealthStatusOk, res.Status)
	})
	t.Run("should fail when version is unknown", func(t *testing.T) {
		s := GetMockService("unknown-influx-version", RoundTripper{
			Body: `{"results": [{"series": [{"columns": ["name"],"name": "measurements","values": [["cpu"],["disk"],["diskio"],["kernel"],["mem"],["processes"],["swap"],["system"]]}],"statement_id": 0}]}`,
		})
		res, _ := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{},
			Headers:       nil,
		})
		assert.Equal(t, backend.HealthStatusError, res.Status)
	})
}
