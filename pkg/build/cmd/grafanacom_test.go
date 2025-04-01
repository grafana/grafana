package main

import (
	"fmt"
	"net/url"
	"path"
	"testing"

	"github.com/grafana/grafana/pkg/build/packaging"
	"github.com/grafana/grafana/pkg/build/versions"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_constructURL(t *testing.T) {
	type args struct {
		product string
		pth     string
	}
	tests := []struct {
		name    string
		args    args
		want    string
		wantErr bool
	}{
		{name: "cleans .. sequence", args: args{"..", ".."}, want: "https://grafana.com/api", wantErr: false},
		{name: "doesn't clean anything - non malicious url", args: args{"foo", "bar"}, want: "https://grafana.com/api/foo/bar", wantErr: false},
		{name: "doesn't clean anything - three dots", args: args{"...", "..."}, want: "https://grafana.com/api/.../...", wantErr: false},
		{name: "cleans .", args: args{"..", ".."}, want: "https://grafana.com/api", wantErr: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := constructURL(tt.args.product, tt.args.pth)
			if (err != nil) != tt.wantErr {
				t.Errorf("constructURL() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("constructURL() got = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestBuilds(t *testing.T) {
	baseURL := &url.URL{
		Scheme: "https",
		Host:   "dl.example.com",
		Path:   path.Join("oss", "release"),
	}

	version := "1.2.3"
	grafana := "grafana"
	packages := []packaging.BuildArtifact{
		{
			Distro: "deb",
			Arch:   "arm64",
			Ext:    "deb",
		},
		{
			Distro: "rhel",
			Arch:   "aarch64",
			Ext:    "rpm",
		},
		{
			Distro: "linux",
			Arch:   "arm64",
			Ext:    "tar.gz",
		},
		{
			Distro:      "deb",
			Arch:        "armhf",
			Ext:         "deb",
			RaspberryPi: true,
		},
		{
			Distro: "deb",
			Arch:   "armhf",
			Ext:    "deb",
		},
		{
			Distro: "linux",
			Arch:   "armv7",
			Ext:    "tar.gz",
		},
		{
			Distro: "windows",
			Arch:   "amd64",
			Ext:    "zip",
		},
		{
			Distro: "windows",
			Arch:   "amd64",
			Ext:    "msi",
		},
	}

	expect := []GCOMPackage{
		{
			URL:  "https://dl.example.com/oss/release/grafana_1.2.3_arm64.deb",
			OS:   "deb",
			Arch: "arm64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3-1.aarch64.rpm",
			OS:   "rhel",
			Arch: "arm64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3.linux-arm64.tar.gz",
			OS:   "linux",
			Arch: "arm64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-rpi_1.2.3_armhf.deb",
			OS:   "deb",
			Arch: "armv6",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana_1.2.3_armhf.deb",
			OS:   "deb",
			Arch: "armv7",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3.linux-armv7.tar.gz",
			OS:   "linux",
			Arch: "armv7",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3.windows-amd64.zip",
			OS:   "win",
			Arch: "amd64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3.windows-amd64.msi",
			OS:   "win-installer",
			Arch: "amd64",
		},
	}

	builds, err := Builds(baseURL, grafana, version, packages)
	require.NoError(t, err)
	require.Equal(t, len(expect), len(builds))

	for i := range builds {
		t.Run(fmt.Sprintf("[%d/%d] %s", i+1, len(builds), expect[i].URL), func(t *testing.T) {
			assert.Equal(t, expect[i].URL, builds[i].URL)
			assert.Equal(t, expect[i].OS, builds[i].OS)
			assert.Equal(t, expect[i].Arch, builds[i].Arch)
		})
	}
}

func TestBuildsWithPlus(t *testing.T) {
	baseURL := &url.URL{
		Scheme: "https",
		Host:   "dl.example.com",
		Path:   path.Join("oss", "release"),
	}

	version := "1.2.3+example-01"
	grafana := "grafana"
	packages := []packaging.BuildArtifact{
		{
			Distro: "deb",
			Arch:   "arm64",
			Ext:    "deb",
		},
		{
			Distro: "rhel",
			Arch:   "aarch64",
			Ext:    "rpm",
		},
		{
			Distro: "linux",
			Arch:   "arm64",
			Ext:    "tar.gz",
		},
		{
			Distro:      "deb",
			Arch:        "armhf",
			Ext:         "deb",
			RaspberryPi: true,
		},
		{
			Distro: "deb",
			Arch:   "armhf",
			Ext:    "deb",
		},
		{
			Distro: "linux",
			Arch:   "armv7",
			Ext:    "tar.gz",
		},
		{
			Distro: "windows",
			Arch:   "amd64",
			Ext:    "zip",
		},
		{
			Distro: "windows",
			Arch:   "amd64",
			Ext:    "msi",
		},
	}

	expect := []GCOMPackage{
		{
			URL:  "https://dl.example.com/oss/release/grafana_1.2.3+example~01_arm64.deb",
			OS:   "deb",
			Arch: "arm64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3+example~01-1.aarch64.rpm",
			OS:   "rhel",
			Arch: "arm64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3+example-01.linux-arm64.tar.gz",
			OS:   "linux",
			Arch: "arm64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-rpi_1.2.3+example~01_armhf.deb",
			OS:   "deb",
			Arch: "armv6",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana_1.2.3+example~01_armhf.deb",
			OS:   "deb",
			Arch: "armv7",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3+example-01.linux-armv7.tar.gz",
			OS:   "linux",
			Arch: "armv7",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3+example-01.windows-amd64.zip",
			OS:   "win",
			Arch: "amd64",
		},
		{
			URL:  "https://dl.example.com/oss/release/grafana-1.2.3+example-01.windows-amd64.msi",
			OS:   "win-installer",
			Arch: "amd64",
		},
	}

	builds, err := Builds(baseURL, grafana, version, packages)
	require.NoError(t, err)
	require.Equal(t, len(expect), len(builds))

	for i := range builds {
		t.Run(fmt.Sprintf("[%d/%d] %s", i+1, len(builds), expect[i].URL), func(t *testing.T) {
			assert.Equal(t, expect[i].URL, builds[i].URL)
			assert.Equal(t, expect[i].OS, builds[i].OS)
			assert.Equal(t, expect[i].Arch, builds[i].Arch)
		})
	}
}

func TestReleaseURLs(t *testing.T) {
	f := "https://grafana.com/whats-new-in-v%[1]s-%[2]s"

	smv := versions.Semver{
		Major: "1",
		Minor: "2",
		Patch: "3",
	}

	conf := packageConf{
		Grafana: grafanaConf{
			WhatsNewURL:     f,
			ReleaseNotesURL: "https://example.com",
		},
	}

	expect := "https://grafana.com/whats-new-in-v1-2"

	a, _, err := getReleaseURLs(smv, &conf)
	require.NoError(t, err)
	require.Equal(t, expect, a)
}
