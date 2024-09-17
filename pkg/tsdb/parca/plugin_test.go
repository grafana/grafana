package parca

import (
	"context"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/stretchr/testify/require"
)

// This is where the tests for the datasource backend live.
func Test_QueryData(t *testing.T) {
	ds := ParcaDatasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{
					RefID:     "A",
					QueryType: "profile",
				},
			},
		},
	)
	if err != nil {
		t.Error(err)
	}

	if len(resp.Responses) != 1 {
		t.Fatal("QueryData must return a response")
	}
}

func Test_CallResource(t *testing.T) {
	ds := &ParcaDatasource{
		client: &FakeClient{},
	}

	t.Run("labels resource", func(t *testing.T) {
		sender := &FakeSender{}
		err := ds.CallResource(
			context.Background(),
			&backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "labelNames",
				Method:        "GET",
				URL:           "labelNames",
				Headers:       nil,
				Body:          nil,
			},
			sender,
		)
		require.NoError(t, err)
		require.Equal(t, 200, sender.Resp.Status)
		require.Equal(t, `["instance","job"]`, string(sender.Resp.Body))
	})
}

type FakeSender struct {
	Resp *backend.CallResourceResponse
}

func (fs *FakeSender) Send(resp *backend.CallResourceResponse) error {
	fs.Resp = resp
	return nil
}
