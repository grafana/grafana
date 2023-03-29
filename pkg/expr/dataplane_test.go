package expr

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/davecgh/go-spew/spew"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/services/datasources"
	datafakes "github.com/grafana/grafana/pkg/services/datasources/fakes"
	"github.com/grafana/grafana/pkg/setting"
	jsoniter "github.com/json-iterator/go"
	"github.com/stretchr/testify/require"
)

func TestSomething(t *testing.T) {
	filepath.Walk("../../../dataplane/testExampleData/numeric/", func(path string, info os.FileInfo, err error) error {
		if err != nil {
			t.Fatalf(err.Error())
		}
		if !info.IsDir() {
			frames := make(data.Frames, 0)
			b, err := os.ReadFile(path)
			require.NoError(t, err)
			err = testIterRead(&frames, b)
			require.NoError(t, err)

			returnedFrames, err := framesPassThroughService(t, frames)
			require.NoError(t, err)

			spew.Dump(returnedFrames)
		}
		return nil
	})
}

func framesPassThroughService(t *testing.T, frames data.Frames) (data.Frames, error) {
	me := &mockEndpoint{
		Frames: frames,
	}

	cfg := setting.NewCfg()

	s := Service{
		cfg:               cfg,
		dataService:       me,
		dataSourceService: &datafakes.FakeDataSourceService{},
	}
	queries := []Query{{
		RefID: "A",
		DataSource: &datasources.DataSource{
			OrgID: 1,
			UID:   "test",
			Type:  "test",
		},
		JSON: json.RawMessage(`{ "datasource": { "uid": "1" }, "intervalMs": 1000, "maxDataPoints": 1000 }`),
		TimeRange: AbsoluteTimeRange{
			From: time.Time{},
			To:   time.Time{},
		},
	}}

	req := &Request{Queries: queries}

	pl, err := s.BuildPipeline(req)
	require.NoError(t, err)

	res, err := s.ExecutePipeline(context.Background(), time.Now(), pl)
	require.NoError(t, err)

	require.Contains(t, res.Responses, "A")

	return res.Responses["A"].Frames, res.Responses["A"].Error
}

func testIterRead(d *data.Frames, b []byte) error {
	iter := jsoniter.ParseBytes(jsoniter.ConfigDefault, b)
	for iter.ReadArray() {
		frame := &data.Frame{}
		iter.ReadVal(frame)
		if iter.Error != nil {
			return iter.Error
		}
		*d = append(*d, frame)
	}
	return nil
}
