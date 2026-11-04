package setting

import (
	"testing"

	"github.com/spf13/pflag"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestReportGRPCCodesInInstrumentationLabelEnabled(t *testing.T) {
	t.Run("ini defaults to true", func(t *testing.T) {
		cfg := NewCfg()
		require.NoError(t, readGRPCServerSettings(cfg, ini.Empty()))
		require.True(t, cfg.GRPCServer.ReportGRPCCodesInInstrumentationLabelEnabled)
	})

	t.Run("ini can disable", func(t *testing.T) {
		iniFile := ini.Empty()
		iniFile.Section("grpc_server").Key("report_grpc_codes_in_instrumentation_label_enabled").SetValue("false")
		cfg := NewCfg()
		require.NoError(t, readGRPCServerSettings(cfg, iniFile))
		require.False(t, cfg.GRPCServer.ReportGRPCCodesInInstrumentationLabelEnabled)
	})

	t.Run("flag defaults to true and can disable", func(t *testing.T) {
		var settings GRPCServerSettings
		fs := pflag.NewFlagSet("test", pflag.ContinueOnError)
		settings.AddFlags(fs)
		require.NoError(t, fs.Parse(nil))
		require.True(t, settings.ReportGRPCCodesInInstrumentationLabelEnabled)

		require.NoError(t, fs.Parse([]string{"--grpc-server-report-grpc-codes-in-instrumentation-label-enabled=false"}))
		require.False(t, settings.ReportGRPCCodesInInstrumentationLabelEnabled)
	})
}
