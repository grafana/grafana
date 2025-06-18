package main

var debMapping = map[string]m{
	"OSS: Linux AMD64 on main": {
		env: map[string]string{
			"IS_MAIN": "true",
		},
		input: "file://dist/grafana_v1.2.3_102_linux_amd64.deb",
		output: []string{
			"oss/main/grafana_1.2.3_amd64.deb",
		},
	},
	"OSS: Linux AMD64 on main with - in version": {
		env: map[string]string{
			"IS_MAIN": "true",
		},
		input: "file://dist/grafana_v1.2.3-102_102_linux_amd64.deb",
		output: []string{
			"oss/main/grafana_1.2.3~102_amd64.deb",
		},
	},
	"OSS: Linux AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana_1.2.3_amd64.deb",
		},
	},
	"OSS: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.deb.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana_1.2.3_amd64.deb.sha256",
		},
	},
	"OSS: Linux ARM7": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana_1.2.3_armhf.deb",
		},
	},
	"OSS: RPI ARM7": {
		input: "gs://bucket/tag/grafana-rpi_v1.2.3_102_linux_arm-7.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-rpi_1.2.3_armhf.deb",
		},
	},
	"OSS: RPI ARM6": {
		input: "gs://bucket/tag/grafana-rpi_v1.2.3_102_linux_arm-6.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-rpi_1.2.3_armhf.deb",
		},
	},
	"OSS: Linux ARM7 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.deb.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana_1.2.3_armhf.deb.sha256",
		},
	},
	"OSS: Linux ARM64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana_1.2.3_arm64.deb",
		},
	},
	"OSS: Linux ARM64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.deb.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana_1.2.3_arm64.deb.sha256",
		},
	},
	"ENT: Linux AMD64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise_1.2.3_amd64.deb",
		},
	},
	"ENT: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.deb.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise_1.2.3_amd64.deb.sha256",
		},
	},
	"ENT: Linux ARM64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise_1.2.3_arm64.deb",
		},
	},
	"ENT: Linux ARM64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.deb.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise_1.2.3_arm64.deb.sha256",
		},
	},
	"ENT: Linux ARM7": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise_1.2.3_armhf.deb",
		},
	},
	"ENT: RPI ARM7": {
		input: "gs://bucket/tag/grafana-enterprise-rpi_v1.2.3_102_linux_arm-7.deb",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-rpi_1.2.3_armhf.deb",
		},
	},
	"ENT: ARM7 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.deb.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise_1.2.3_armhf.deb.sha256",
		},
	},
	"ENT2: RPI ARM7": {
		input: "gs://bucket/tag/grafana-pro-rpi_v1.2.3_102_linux_arm-7.deb",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3/enterprise2/release/grafana-enterprise2-rpi_1.2.3_armhf.deb",
		},
	},
	"ENT2: Pre-release AMD64": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3-pre.4_102_linux_amd64.deb",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2_1.2.3~pre.4_amd64.deb",
		},
	},
	"ENT2: Pre-release AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3-pre.4_102_linux_amd64.deb.sha256",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2_1.2.3~pre.4_amd64.deb.sha256",
		},
	},
}
