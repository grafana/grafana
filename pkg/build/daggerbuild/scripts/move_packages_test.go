package main

import (
	"sort"
	"testing"

	"github.com/stretchr/testify/require"
)

type m struct {
	input  string
	output []string
	env    map[string]string
}

var targzMapping = map[string]m{
	"ENT: Darwin AMD64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_darwin_amd64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.darwin-amd64.tar.gz",
		},
	},
	"ENT: Darwin AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_darwin_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.darwin-amd64.tar.gz.sha256",
		},
	},
	"ENT: AMD64 with MUSL copy": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-amd64-musl.tar.gz",
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-amd64.tar.gz",
		},
	},
	"ENT: AMD64 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-amd64-musl.tar.gz.sha256",
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-amd64.tar.gz.sha256",
		},
	},
	"ENT: ARM64 with MUSL copy": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-arm64-musl.tar.gz",
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-arm64.tar.gz",
		},
	},
	"ENT: ARM64 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-arm64-musl.tar.gz.sha256",
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-arm64.tar.gz.sha256",
		},
	},
	"ENT: ARM6": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-6.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-armv6.tar.gz",
		},
	},
	"ENT: ARM6 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-6.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-armv6.tar.gz.sha256",
		},
	},
	"ENT: ARM7 with MUSL copy": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-armv7-musl.tar.gz",
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-armv7.tar.gz",
		},
	},
	"ENT: ARM7 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-armv7-musl.tar.gz.sha256",
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.linux-armv7.tar.gz.sha256",
		},
	},
	"ENT: Windows AMD64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_windows_amd64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.windows-amd64.tar.gz",
		},
	},
	"ENT: Windows AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_windows_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.windows-amd64.tar.gz.sha256",
		},
	},
	"OSS: ARM6": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-6.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-armv6.tar.gz",
		},
	},
	"OSS: ARM6 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-6.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-armv6.tar.gz.sha256",
		},
	},
	"OSS: ARM7 with MUSL copy": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-armv7-musl.tar.gz",
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-armv7.tar.gz",
		},
	},
	"OSS: ARM7 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-armv7-musl.tar.gz.sha256",
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-armv7.tar.gz.sha256",
		},
	},
	"OSS: Windows AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_windows_amd64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.windows-amd64.tar.gz",
		},
	},
	"OSS: Windows AMD64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_windows_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.windows-amd64.tar.gz.sha256",
		},
	},
	"OSS: Darwin AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_darwin_amd64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.darwin-amd64.tar.gz",
		},
	},
	"OSS: Darwin AMD64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_darwin_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.darwin-amd64.tar.gz.sha256",
		},
	},
	"OSS: Linux AMD64 with MUSL copy": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-amd64-musl.tar.gz",
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-amd64.tar.gz",
		},
	},
	"OSS: Linux AMD64 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-amd64-musl.tar.gz.sha256",
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-amd64.tar.gz.sha256",
		},
	},
	"OSS: Linux ARM64 with MUSL copy": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.tar.gz",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-arm64-musl.tar.gz",
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-arm64.tar.gz",
		},
	},
	"OSS: Linux ARM64 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-arm64-musl.tar.gz.sha256",
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.linux-arm64.tar.gz.sha256",
		},
	},
	"ENT2: Linux AMD64 with MUSL copy": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3-pre.4_102_linux_amd64.tar.gz",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2-1.2.3-pre.4.linux-amd64-musl.tar.gz",
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2-1.2.3-pre.4.linux-amd64.tar.gz",
		},
	},
	"ENT2: Linux AMD64 SHA256 with MUSL copy": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3-pre.4_102_linux_amd64.tar.gz.sha256",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2-1.2.3-pre.4.linux-amd64-musl.tar.gz.sha256",
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2-1.2.3-pre.4.linux-amd64.tar.gz.sha256",
		},
	},
}

func TestGetHandler(t *testing.T) {
	runTests(t, "TARGZ: ", targzMapping)
	runTests(t, "DOCKER: ", dockerMapping)
	runTests(t, "CDN: ", cdnMapping)
	runTests(t, "ZIP: ", zipMapping)
	runTests(t, "MSI: ", msiMapping)
	runTests(t, "NPM: ", npmMapping)
	runTests(t, "DEB: ", debMapping)
	runTests(t, "RPM: ", rpmMapping)
	runTests(t, "EXE: ", exeMapping)
	runTests(t, "STORYBOOK: ", storybookMapping)
}

func runTests(t *testing.T, namePrefix string, tests map[string]m) {
	t.Helper()
	for testname, testcase := range tests {
		t.Run(namePrefix+testname, func(t *testing.T) {
			for envName, envValue := range testcase.env {
				t.Setenv(envName, envValue)
			}
			handler, _ := getHandler(testcase.input, Handlers)
			output := handler(testcase.input)
			sort.Strings(output)
			require.Equal(t, testcase.output, output)
		})
	}
}
