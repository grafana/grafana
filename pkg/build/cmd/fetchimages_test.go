package main

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/config"
	"github.com/stretchr/testify/require"
)

func TestGetImageFiles(t *testing.T) {
	var (
		architectures = []config.Architecture{
			config.ArchAMD64,
			config.ArchARM64,
			config.ArchARMv7,
		}
	)

	t.Run("1.2.3", func(t *testing.T) {
		expect := []string{
			"grafana-oss-1.2.3-amd64.img",
			"grafana-oss-1.2.3-arm64.img",
			"grafana-oss-1.2.3-armv7.img",
			"grafana-oss-1.2.3-ubuntu-amd64.img",
			"grafana-oss-1.2.3-ubuntu-arm64.img",
			"grafana-oss-1.2.3-ubuntu-armv7.img",
		}

		res := GetImageFiles("grafana-oss", "1.2.3", architectures)

		require.Equal(t, expect, res)
	})

	t.Run("1.2.3+example-01", func(t *testing.T) {
		expect := []string{
			"grafana-oss-1.2.3+example-01-amd64.img",
			"grafana-oss-1.2.3+example-01-arm64.img",
			"grafana-oss-1.2.3+example-01-armv7.img",
			"grafana-oss-1.2.3+example-01-ubuntu-amd64.img",
			"grafana-oss-1.2.3+example-01-ubuntu-arm64.img",
			"grafana-oss-1.2.3+example-01-ubuntu-armv7.img",
		}

		res := GetImageFiles("grafana-oss", "1.2.3+example-01", architectures)

		require.Equal(t, expect, res)
	})
}
