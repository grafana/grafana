package pipelines_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/pipelines"
)

func TestWithoutExt(t *testing.T) {
	names := map[string]string{
		"grafana_v1.0.1-test_333_plan9_amd64.tar.gz":                          "grafana_v1.0.1-test_333_plan9_amd64",
		"grafana-enterprise_v1.0.1-test_333_plan9_amd64.tar.gz":               "grafana-enterprise_v1.0.1-test_333_plan9_amd64",
		"grafana-enterprise_v1.0.1-test_333_plan9_arm-6.tar.gz":               "grafana-enterprise_v1.0.1-test_333_plan9_arm-6",
		"grafana-enterprise_v1.0.1-test_333_plan9_amd64.deb":                  "grafana-enterprise_v1.0.1-test_333_plan9_amd64",
		"grafana-enterprise_v1.0.1-test_333_plan9_arm-6.deb":                  "grafana-enterprise_v1.0.1-test_333_plan9_arm-6",
		"grafana-enterprise_v1.0.1-test_333_plan9_arm-6.docker.tar.gz":        "grafana-enterprise_v1.0.1-test_333_plan9_arm-6",
		"grafana-enterprise_v1.0.1-test_333_plan9_arm-6.ubuntu.docker.tar.gz": "grafana-enterprise_v1.0.1-test_333_plan9_arm-6",
	}

	for k, v := range names {
		if n := pipelines.WithoutExt(k); n != v {
			t.Errorf("Expected '%s' without file name to equal '%s' but got '%s'", k, v, n)
		}
	}
}

func TestOptsFromFile(t *testing.T) {
	t.Run("It should get the correct tar file opts from a valid name", func(t *testing.T) {
		name := "grafana-enterprise_v1.0.1-test_333_plan9_arm-6.tar.gz"
		distro := backend.Distribution("plan9/arm/v6")
		expect := pipelines.TarFileOpts{
			Edition: "enterprise",
			Version: "v1.0.1-test",
			BuildID: "333",
			Distro:  distro,
		}
		got := pipelines.TarOptsFromFileName(name)
		if got.Edition != expect.Edition {
			t.Errorf("got.Edition != expect.Edition, expected '%s'", expect.Edition)
		}
		if got.Version != expect.Version {
			t.Errorf("got.Version != expect.Version, expected '%s', got '%s'", expect.Version, got.Version)
		}
		if got.BuildID != expect.BuildID {
			t.Errorf("got.BuildID != expect.BuildID, expected '%s', got '%s'", expect.BuildID, got.BuildID)
		}
		if got.Distro != expect.Distro {
			t.Errorf("got.Distro != expect.Distro, expected '%s', got '%s'", expect.Distro, got.Distro)
		}
	})
	t.Run("It should consider only the basename", func(t *testing.T) {
		name := "somewhere/grafana-enterprise_v1.0.1-test_333_plan9_arm-6.tar.gz"
		distro := backend.Distribution("plan9/arm/v6")
		expect := pipelines.TarFileOpts{
			Edition: "enterprise",
			Version: "v1.0.1-test",
			BuildID: "333",
			Distro:  distro,
		}
		got := pipelines.TarOptsFromFileName(name)
		if got.Edition != expect.Edition {
			t.Errorf("got.Edition != expect.Edition, expected '%s'", expect.Edition)
		}
		if got.Version != expect.Version {
			t.Errorf("got.Version != expect.Version, expected '%s', got '%s'", expect.Version, got.Version)
		}
		if got.BuildID != expect.BuildID {
			t.Errorf("got.BuildID != expect.BuildID, expected '%s', got '%s'", expect.BuildID, got.BuildID)
		}
		if got.Distro != expect.Distro {
			t.Errorf("got.Distro != expect.Distro, expected '%s', got '%s'", expect.Distro, got.Distro)
		}
	})
	t.Run("It should support editions with multiple hyphens", func(t *testing.T) {
		name := "somewhere/grafana-enterprise-rpi_v1.0.1-test_333_plan9_arm-6.tar.gz"
		distro := backend.Distribution("plan9/arm/v6")
		expect := pipelines.TarFileOpts{
			Edition: "enterprise-rpi",
			Version: "v1.0.1-test",
			BuildID: "333",
			Distro:  distro,
		}
		got := pipelines.TarOptsFromFileName(name)
		if got.Edition != expect.Edition {
			t.Errorf("got.Edition != expect.Edition, expected '%s', got '%s'", expect.Edition, got.Edition)
		}
		if got.Version != expect.Version {
			t.Errorf("got.Version != expect.Version, expected '%s', got '%s'", expect.Version, got.Version)
		}
		if got.BuildID != expect.BuildID {
			t.Errorf("got.BuildID != expect.BuildID, expected '%s', got '%s'", expect.BuildID, got.BuildID)
		}
		if got.Distro != expect.Distro {
			t.Errorf("got.Distro != expect.Distro, expected '%s', got '%s'", expect.Distro, got.Distro)
		}
	})
}
