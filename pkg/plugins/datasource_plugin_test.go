package plugins

import "testing"

func TestExecutablePathBuilder(t *testing.T) {

	have := buildExecutablePath("/var/grafana/plugins/grafana-simple-json-datasource", "simple-json", "linux", "amd64")
	want := `/var/grafana/plugins/grafana-simple-json-datasource/simple-json_linux_amd64`
	if have != want {
		t.Errorf("expected %s got %s", want, have)
	}
}
