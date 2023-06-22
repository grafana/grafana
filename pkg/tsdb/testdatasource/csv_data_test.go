package testdatasource

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestCSVFileScenario(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()
	cfg.StaticRootPath = "../../../public"

	s := &Service{}

	t.Run("loadCsvFile", func(t *testing.T) {
		files := []string{"simple", "mixed", "labels"}
		for _, name := range files {
			t.Run("Should load CSV Text: "+name, func(t *testing.T) {
				filePath := filepath.Join("testdata", name+".csv")
				// Can ignore gosec G304 here, because this is a constant defined above
				// nolint:gosec
				fileReader, err := os.Open(filePath)
				require.NoError(t, err)

				defer func() {
					_ = fileReader.Close()
				}()

				frame, err := LoadCsvContent(fileReader, name)
				require.NoError(t, err)
				require.NotNil(t, frame)

				dr := &backend.DataResponse{
					Frames: data.Frames{frame},
				}
				experimental.CheckGoldenJSONResponse(t, "testdata", name+".golden", dr, true)
			})
		}

		t.Run("Should not allow non file name chars", func(t *testing.T) {
			_, err := s.loadCsvFile("../population_by_state.csv")
			require.Error(t, err)
		})
	})
}

func TestReadCSV(t *testing.T) {
	fBool, err := csvLineToField("T, F,F,T  ,")
	require.NoError(t, err)

	fBool2, err := csvLineToField("true,false,T,F,F")
	require.NoError(t, err)

	fNum, err := csvLineToField("1,null,,4,5")
	require.NoError(t, err)

	fStr, err := csvLineToField("a,b,,,c")
	require.NoError(t, err)

	frame := data.NewFrame("", fBool, fBool2, fNum, fStr)
	out, err := data.FrameToJSON(frame, data.IncludeAll)
	require.NoError(t, err)

	require.JSONEq(t, `{"schema":{
		"fields":[
			{"type":"boolean","typeInfo":{"frame":"bool","nullable":true}},
			{"type":"boolean","typeInfo":{"frame":"bool","nullable":true}},
			{"type":"number","typeInfo":{"frame":"int64","nullable":true}},
			{"type":"string","typeInfo":{"frame":"string","nullable":true}}
		]},"data":{
			"values":[
				[true,false,false,true,null],
				[true,false,true,false,false],
				[1,null,null,4,5],
				["a","b",null,null,"c"]
		]}}`, string(out))
}
