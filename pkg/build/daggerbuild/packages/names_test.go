package packages_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
)

func TestFileName(t *testing.T) {
	t.Run("It should use the correct name if Enterprise is false", func(t *testing.T) {
		distro := backend.Distribution("plan9/amd64")
		opts := packages.NameOpts{
			Name:      "grafana",
			Version:   "v1.0.1-test",
			BuildID:   "333",
			Distro:    distro,
			Extension: "tar.gz",
		}

		expected := "grafana_v1.0.1-test_333_plan9_amd64.tar.gz"
		if name, _ := packages.FileName(opts.Name, opts.Version, opts.BuildID, opts.Distro, opts.Extension); name != expected {
			t.Errorf("name '%s' does not match expected name '%s'", name, expected)
		}
	})
	t.Run("It should use the correct name if Enterprise is true", func(t *testing.T) {
		distro := backend.Distribution("plan9/amd64")
		opts := packages.NameOpts{
			Name:      "grafana-enterprise",
			Version:   "v1.0.1-test",
			BuildID:   "333",
			Distro:    distro,
			Extension: "tar.gz",
		}

		expected := "grafana-enterprise_v1.0.1-test_333_plan9_amd64.tar.gz"
		if name, _ := packages.FileName(opts.Name, opts.Version, opts.BuildID, opts.Distro, opts.Extension); name != expected {
			t.Errorf("name '%s' does not match expected name '%s'", name, expected)
		}
	})
	t.Run("It should use include the arch version if one is supplied in the distro", func(t *testing.T) {
		distro := backend.Distribution("plan9/arm/v6")
		opts := packages.NameOpts{
			Name:      "grafana-enterprise",
			Version:   "v1.0.1-test",
			BuildID:   "333",
			Distro:    distro,
			Extension: "tar.gz",
		}

		expected := "grafana-enterprise_v1.0.1-test_333_plan9_arm-6.tar.gz"
		if name, _ := packages.FileName(opts.Name, opts.Version, opts.BuildID, opts.Distro, opts.Extension); name != expected {
			t.Errorf("name '%s' does not match expected name '%s'", name, expected)
		}
	})
	t.Run("It should support grafana names with multiple hyphens", func(t *testing.T) {
		distro := backend.Distribution("plan9/arm/v6")
		opts := packages.NameOpts{
			Name:      "grafana-enterprise-rpi",
			Version:   "v1.0.1-test",
			BuildID:   "333",
			Distro:    distro,
			Extension: "tar.gz",
		}

		expected := "grafana-enterprise-rpi_v1.0.1-test_333_plan9_arm-6.tar.gz"
		if name, _ := packages.FileName(opts.Name, opts.Version, opts.BuildID, opts.Distro, opts.Extension); name != expected {
			t.Errorf("name '%s' does not match expected name '%s'", name, expected)
		}
	})
}
