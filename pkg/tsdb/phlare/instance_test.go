package phlare

import (
	"bytes"
	"compress/gzip"
	"context"
	"io"
	"testing"

	"google.golang.org/protobuf/proto"

	"github.com/google/go-cmp/cmp"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	googlev1 "github.com/grafana/phlare/api/gen/proto/go/google/v1"
	"github.com/stretchr/testify/require"
)

// This is where the tests for the datasource backend live.
func Test_QueryData(t *testing.T) {
	ds := PhlareDatasource{}

	resp, err := ds.QueryData(
		context.Background(),
		&backend.QueryDataRequest{
			Queries: []backend.DataQuery{
				{RefID: "A"},
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
	ds := &PhlareDatasource{
		client: &FakeClient{},
	}

	t.Run("series resource", func(t *testing.T) {
		sender := &FakeSender{}
		err := ds.CallResource(
			context.Background(),
			&backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "series",
				Method:        "GET",
				URL:           "series?matchers=%7B%7D",
				Headers:       nil,
				Body:          nil,
			},
			sender,
		)
		require.NoError(t, err)
		require.Equal(t, 200, sender.Resp.Status)
		require.Equal(t, `[{"labels":[{"name":"instance","value":"127.0.0.1"},{"name":"job","value":"default"}]}]`, string(sender.Resp.Body))
	})

	t.Run("downloadPprof", func(t *testing.T) {
		sender := &FakeSender{}
		err := ds.CallResource(
			context.Background(),
			&backend.CallResourceRequest{
				PluginContext: backend.PluginContext{},
				Path:          "downloadPprof",
				Method:        "GET",
				URL:           `downloadPprof?profileTypeId=process_cpu%3Acpu%3Ananoseconds%3Acpu%3Ananoseconds&labelSelector=%7Bapp%3D%22foo%22%7D&start=0&end=1000`,
				Headers:       nil,
				Body:          nil,
			},
			sender,
		)
		require.NoError(t, err)
		require.Equal(t, 200, sender.Resp.Status)
		reader, err := gzip.NewReader(bytes.NewReader(sender.Resp.Body))
		require.NoError(t, err)
		data, err := io.ReadAll(reader)
		require.NoError(t, err)
		prof := &googlev1.Profile{}
		err = proto.Unmarshal(data, prof)
		require.NoError(t, err)
		EqualProto(t, fakeProfile, prof)
	})
}

func EqualProto(t *testing.T, expected, actual interface{}) {
	t.Helper()
	if diff := cmp.Diff(expected, actual, ignoreProtoFields()); diff != "" {
		t.Errorf("result mismatch (-want +got):\n%s", diff)
	}
}

func ignoreProtoFields() cmp.Option {
	return cmp.FilterPath(func(p cmp.Path) bool {
		switch p[len(p)-1].String() {
		case ".state", ".sizeCache", ".unknownFields":
			return true
		}
		return false
	}, cmp.Ignore())
}

type FakeSender struct {
	Resp *backend.CallResourceResponse
}

func (fs *FakeSender) Send(resp *backend.CallResourceResponse) error {
	fs.Resp = resp
	return nil
}
