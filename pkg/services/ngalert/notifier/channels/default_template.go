package channels

import (
	"os"
	"testing"

	"github.com/grafana/alerting/alerting/notifier/channels"
	"github.com/prometheus/alertmanager/template"
	"github.com/stretchr/testify/require"
)

func templateForTests(t *testing.T) *template.Template {
	f, err := os.CreateTemp("/tmp", "template")
	require.NoError(t, err)
	defer func(f *os.File) {
		_ = f.Close()
	}(f)

	t.Cleanup(func() {
		require.NoError(t, os.RemoveAll(f.Name()))
	})

	_, err = f.WriteString(channels.TemplateForTestsString)
	require.NoError(t, err)

	tmpl, err := template.FromGlobs(f.Name())
	require.NoError(t, err)

	return tmpl
}
