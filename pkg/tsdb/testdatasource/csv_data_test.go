package testdatasource

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/require"
)

func TestCSVFileScenario(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.DataPath = t.TempDir()
	cfg.StaticRootPath = "../../../public"

	p := &testDataPlugin{
		Cfg: cfg,
	}

	t.Run("loadCsvFile", func(t *testing.T) {
		t.Run("Should load file and convert to DataFrame", func(t *testing.T) {
			frame, err := p.loadCsvFile("population_by_state.csv")
			require.NoError(t, err)
			require.NotNil(t, frame)

			require.Len(t, frame.Fields, 4)

			require.Equal(t, "State", frame.Fields[0].Name)
			require.Equal(t, "2020", frame.Fields[1].Name)
			require.Equal(t, data.FieldTypeString, frame.Fields[0].Type())
			require.Equal(t, data.FieldTypeFloat64, frame.Fields[1].Type())
			require.GreaterOrEqual(t, frame.Fields[0].Len(), 2)

			val, ok := frame.Fields[1].ConcreteAt(0)
			require.True(t, ok)
			require.Equal(t, float64(39368078), val)
		})

		t.Run("Should not allow non file name chars", func(t *testing.T) {
			_, err := p.loadCsvFile("../population_by_state.csv")
			require.Error(t, err)
		})
	})
}
