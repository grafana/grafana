package gcom_test

import (
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/build/gcom"
	"github.com/stretchr/testify/require"
)

func TestPackageName(t *testing.T) {
	type args struct {
		Distro      string
		Arch        string
		Version     string
		Ext         string
		Musl        bool
		RaspberryPi bool

		Expect string
	}

	cases := []args{
		{
			RaspberryPi: true,
			Distro:      "deb",
			Arch:        "armhf",
			Version:     "1.2.3",
			Ext:         "deb",
			Expect:      "grafana-rpi_1.2.3_armhf.deb",
		},
		{
			Distro:  "deb",
			Arch:    "arm64",
			Version: "1.2.3",
			Ext:     "deb",
			Expect:  "grafana_1.2.3_arm64.deb",
		},
		{
			Distro:  "rhel",
			Arch:    "aarch64",
			Version: "1.2.3",
			Ext:     "rpm",
			Expect:  "grafana-1.2.3-1.aarch64.rpm",
		},
		{
			Distro:  "rhel",
			Arch:    "aarch64",
			Ext:     "rpm.sha256",
			Version: "1.2.3",
			Expect:  "grafana-1.2.3-1.aarch64.rpm.sha256",
		},
		{
			Distro:  "rhel",
			Ext:     "rpm",
			Version: "1.2.3",
			Arch:    "x86_64",
			Expect:  "grafana-1.2.3-1.x86_64.rpm",
		},
		{
			Distro:  "rhel",
			Ext:     "rpm.sha256",
			Version: "1.2.3",
			Arch:    "x86_64",
			Expect:  "grafana-1.2.3-1.x86_64.rpm.sha256",
		},
		{
			Distro:  "darwin",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "amd64",
			Expect:  "grafana-1.2.3.darwin-amd64.tar.gz",
		},
		{
			Distro:  "darwin",
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Arch:    "amd64",
			Expect:  "grafana-1.2.3.darwin-amd64.tar.gz.sha256",
		},
		{
			Distro:  "darwin",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.darwin-arm64-musl.tar.gz",
			Musl:    true,
		},
		{
			Distro:  "darwin",
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.darwin-arm64-musl.tar.gz.sha256",
			Musl:    true,
		},
		{
			Distro:  "darwin",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.darwin-arm64.tar.gz",
		},
		{
			Distro:  "darwin",
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.darwin-arm64.tar.gz.sha256",
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "amd64",
			Expect:  "grafana-1.2.3.linux-amd64-musl.tar.gz",
			Musl:    true,
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Arch:    "amd64",
			Expect:  "grafana-1.2.3.linux-amd64-musl.tar.gz.sha256",
			Musl:    true,
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "amd64",
			Expect:  "grafana-1.2.3.linux-amd64.tar.gz",
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Arch:    "amd64",
			Expect:  "grafana-1.2.3.linux-amd64.tar.gz.sha256",
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.linux-arm64-musl.tar.gz",
			Musl:    true,
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.linux-arm64-musl.tar.gz.sha256",
			Musl:    true,
		},
		{
			Distro:  "linux",
			Ext:     "tar.gz",
			Version: "1.2.3",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.linux-arm64.tar.gz",
		},
		{
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.linux-arm64.tar.gz.sha256",
		},
		{
			Ext:     "tar.gz",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "armv6",
			Expect:  "grafana-1.2.3.linux-armv6.tar.gz",
		},
		{
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "armv6",
			Expect:  "grafana-1.2.3.linux-armv6.tar.gz.sha256",
		},
		{
			Ext:     "tar.gz",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "armv7",
			Expect:  "grafana-1.2.3.linux-armv7-musl.tar.gz",
			Musl:    true,
		},
		{
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "armv7",
			Expect:  "grafana-1.2.3.linux-armv7-musl.tar.gz.sha256",
			Musl:    true,
		},
		{
			Ext:     "tar.gz",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "armv7",
			Expect:  "grafana-1.2.3.linux-armv7.tar.gz",
		},
		{
			Ext:     "tar.gz.sha256",
			Version: "1.2.3",
			Distro:  "linux",
			Arch:    "armv7",
			Expect:  "grafana-1.2.3.linux-armv7.tar.gz.sha256",
		},
		{
			Version: "1.2.3",
			Arch:    "amd64",
			Ext:     "exe",
			Distro:  "windows",
			Expect:  "grafana-1.2.3.windows-amd64.exe",
		},
		{
			Version: "1.2.3",
			Arch:    "amd64",
			Distro:  "windows",
			Ext:     "exe.sha256",
			Expect:  "grafana-1.2.3.windows-amd64.exe.sha256",
		},
		{
			Version: "1.2.3",
			Arch:    "amd64",
			Distro:  "windows",
			Ext:     "msi",
			Expect:  "grafana-1.2.3.windows-amd64.msi",
		},
		{
			Version: "1.2.3",
			Arch:    "amd64",
			Distro:  "windows",
			Ext:     "msi.sha256",
			Expect:  "grafana-1.2.3.windows-amd64.msi.sha256",
		},
		{
			Ext:     "tar.gz",
			Version: "1.2.3",
			Distro:  "windows",
			Expect:  "grafana-1.2.3.windows-amd64.tar.gz",
			Arch:    "amd64",
		},
		{
			Version: "1.2.3",
			Distro:  "windows",
			Arch:    "amd64",
			Ext:     "tar.gz.sha256",
			Expect:  "grafana-1.2.3.windows-amd64.tar.gz.sha256",
		},
		{
			Version: "1.2.3",
			Distro:  "windows",
			Expect:  "grafana-1.2.3.windows-amd64.zip",
			Ext:     "zip",
			Arch:    "amd64",
		},
		{
			Version: "1.2.3",
			Distro:  "windows",
			Expect:  "grafana-1.2.3.windows-amd64.zip.sha256",
			Ext:     "zip.sha256",
			Arch:    "amd64",
		},
		{
			Ext:     "tar.gz",
			Version: "1.2.3",
			Distro:  "windows",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.windows-arm64-musl.tar.gz",
			Musl:    true,
		},
		{
			Version: "1.2.3",
			Ext:     "tar.gz.sha256",
			Distro:  "windows",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.windows-arm64-musl.tar.gz.sha256",
			Musl:    true,
		},
		{
			Ext:     "tar.gz",
			Version: "1.2.3",
			Distro:  "windows",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.windows-arm64.tar.gz",
		},
		{
			Version: "1.2.3",
			Ext:     "tar.gz.sha256",
			Distro:  "windows",
			Arch:    "arm64",
			Expect:  "grafana-1.2.3.windows-arm64.tar.gz.sha256",
		},
		{
			RaspberryPi: true,
			Version:     "1.2.3",
			Ext:         "deb",
			Arch:        "armhf",
			Distro:      "deb",
			Expect:      "grafana-rpi_1.2.3_armhf.deb",
		},
		{
			RaspberryPi: true,
			Version:     "1.2.3",
			Ext:         "deb.sha256",
			Distro:      "deb",
			Arch:        "armhf",
			Expect:      "grafana-rpi_1.2.3_armhf.deb.sha256",
		},
		{
			Version: "1.2.3",
			Ext:     "deb",
			Distro:  "deb",
			Expect:  "grafana_1.2.3_amd64.deb",
			Arch:    "amd64",
		},
		{
			Version: "1.2.3",
			Ext:     "deb.sha256",
			Distro:  "deb",
			Expect:  "grafana_1.2.3_amd64.deb.sha256",
			Arch:    "amd64",
		},
		{
			Version: "1.2.3",
			Ext:     "deb",
			Arch:    "arm64",
			Distro:  "deb",
			Expect:  "grafana_1.2.3_arm64.deb",
		},
		{
			Version: "1.2.3",
			Ext:     "deb.sha256",
			Arch:    "arm64",
			Distro:  "deb",
			Expect:  "grafana_1.2.3_arm64.deb.sha256",
		},
		{
			Version: "1.2.3",
			Ext:     "deb",
			Distro:  "deb",
			Arch:    "armhf",
			Expect:  "grafana_1.2.3_armhf.deb",
		},
		{
			Version: "1.2.3",
			Ext:     "deb.sha256",
			Arch:    "armhf",
			Distro:  "deb",
			Expect:  "grafana_1.2.3_armhf.deb.sha256",
		},
	}

	for i, v := range cases {
		t.Run(fmt.Sprintf("[%d / %d] %s", i+1, len(cases), v.Expect), func(t *testing.T) {
			n := gcom.PackageName("grafana", v.Distro, v.Arch, v.Version, v.Ext, v.Musl, v.RaspberryPi)
			require.Equal(t, v.Expect, n)
		})
	}
}
