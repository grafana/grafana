package main

import (
	"testing"
)

type testPackage struct {
	path    string
	version string
	os      string
	arch    string
}

var testData = []testPackage{
	{
		path:    "grafana-5.2.0-474pre1.aarch64.rpm",
		version: "5.2.0-474pre1",
		os:      "rhel",
		arch:    "arm64",
	},
	{
		path:    "grafana-5.2.0-474pre1.armhfp.rpm",
		version: "5.2.0-474pre1",
		os:      "rhel",
		arch:    "armv7",
	},
	{
		path:    "grafana-5.2.0-474pre1.darwin-amd64.tar.gz",
		version: "5.2.0-474pre1",
		os:      "darwin",
		arch:    "amd64",
	},
	{
		path:    "grafana-5.2.0-474pre1.linux-amd64.tar.gz",
		version: "5.2.0-474pre1",
		os:      "linux",
		arch:    "amd64",
	},
	{
		path:    "grafana-5.2.0-474pre1.linux-arm64.tar.gz",
		version: "5.2.0-474pre1",
		os:      "linux",
		arch:    "arm64",
	},
	{
		path:    "grafana-5.2.0-474pre1.linux-armv7.tar.gz",
		version: "5.2.0-474pre1",
		os:      "linux",
		arch:    "armv7",
	},
	{
		path:    "grafana-5.2.0-474pre1.windows-amd64.zip",
		version: "5.2.0-474pre1",
		os:      "win",
		arch:    "amd64",
	},
	{
		path:    "grafana-5.2.0-474pre1.x86_64.rpm",
		version: "5.2.0-474pre1",
		os:      "rhel",
		arch:    "amd64",
	},
	{
		path:    "grafana_5.2.0-474pre1_amd64.deb",
		version: "5.2.0-474pre1",
		os:      "deb",
		arch:    "amd64",
	},
	{
		path:    "grafana_5.2.0-474pre1_arm64.deb",
		version: "5.2.0-474pre1",
		os:      "deb",
		arch:    "arm64",
	},
	{
		path:    "grafana_5.2.0-474pre1_armhf.deb",
		version: "5.2.0-474pre1",
		os:      "deb",
		arch:    "armv7",
	},
}

func TestFileWalker(t *testing.T) {
	for _, packageInfo := range testData {
		version = ""
		actualPackageInfo, err := mapPackage(packageInfo.path, packageInfo.path, []byte{})
		if err != nil {
			t.Error(err)
			continue
		}

		if version != packageInfo.version {
			t.Errorf("Testing (%v), expected %v to be %v.", packageInfo.path, version, packageInfo.version)
		}

		if actualPackageInfo.Os != packageInfo.os {
			t.Errorf("Testing (%v), expected %v to be %v.", packageInfo.path, actualPackageInfo.Os, packageInfo.os)
		}

		if actualPackageInfo.Arch != packageInfo.arch {
			t.Errorf("Testing (%v), expected %v to be %v.", packageInfo.path, actualPackageInfo.Arch, packageInfo.arch)
		}
	}

	incorrectPackageName := "grafana_5.2.0-474pre1_armfoo.deb"
	_, err := mapPackage(incorrectPackageName, incorrectPackageName, []byte{})
	if err == nil {
		t.Errorf("Testing (%v), expected to fail due to an unrecognized arch, but signaled no error.", incorrectPackageName)
	}
}
