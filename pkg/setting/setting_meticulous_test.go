package setting

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestMeticulousSettings(t *testing.T) {
	for _, tc := range []struct {
		name   string
		config string
		env    map[string]string
		want   MeticulousSettings
	}{
		{name: "defaults", want: MeticulousSettings{Production: true}},
		{
			name:   "ini",
			config: "[meticulous]\nenabled = true\nproduction = false\nrecording_token = test-token\nallowed_hosts = localhost:3000, play.grafana.org, ,\n",
			want:   MeticulousSettings{Enabled: true, RecordingToken: "test-token", AllowedHosts: []string{"localhost:3000", "play.grafana.org"}},
		},
		{
			name:   "environment overrides ini",
			config: "[meticulous]\nenabled = false\nproduction = false\nrecording_token = ini-token\nallowed_hosts = old.example.com\n",
			env:    map[string]string{"GF_METICULOUS_ENABLED": "true", "GF_METICULOUS_PRODUCTION": "true", "GF_METICULOUS_RECORDING_TOKEN": "env-token", "GF_METICULOUS_ALLOWED_HOSTS": "localhost:3000,127.0.0.1:3000"},
			want:   MeticulousSettings{Enabled: true, Production: true, RecordingToken: "env-token", AllowedHosts: []string{"localhost:3000", "127.0.0.1:3000"}},
		},
		{
			name: "environment without custom ini keys",
			env:  map[string]string{"GF_METICULOUS_ENABLED": "true", "GF_METICULOUS_PRODUCTION": "false", "GF_METICULOUS_RECORDING_TOKEN": "env-token", "GF_METICULOUS_ALLOWED_HOSTS": "localhost:3000"},
			want: MeticulousSettings{Enabled: true, RecordingToken: "env-token", AllowedHosts: []string{"localhost:3000"}},
		},
		{
			name:   "invalid booleans use defaults",
			config: "[meticulous]\nenabled = invalid\nproduction = invalid\n",
			want:   MeticulousSettings{Production: true},
		},
		{
			name:   "legacy token does not enable recording",
			config: "[analytics]\nmeticulous_ai_recording_token = legacy-token\n",
			want:   MeticulousSettings{Production: true},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			for key, value := range tc.env {
				t.Setenv(key, value)
			}
			file := filepath.Join(t.TempDir(), "custom.ini")
			require.NoError(t, os.WriteFile(file, []byte(tc.config), 0600))
			cfg := NewCfg()
			require.NoError(t, cfg.Load(CommandLineArgs{HomePath: "../../", Config: file}))
			require.Equal(t, tc.want, cfg.Meticulous)
		})
	}
}
