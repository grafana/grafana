package main

var rpmMapping = map[string]m{
	"OSS: Linux AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.rpm",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3-1.x86_64.rpm",
		},
	},
	"OSS: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.rpm.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3-1.x86_64.rpm.sha256",
		},
	},
	"OSS: Linux ARM7": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.rpm",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3-1.armhfp.rpm",
		},
	},
	"OSS: Linux ARM7 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.rpm.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3-1.armhfp.rpm.sha256",
		},
	},
	"OSS: Linux aarch64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_aarch64.rpm",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3-1.aarch64.rpm",
		},
	},
	"OSS: Linux aarch64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.rpm.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3-1.aarch64.rpm.sha256",
		},
	},
	"ENT: Linux AMD64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.rpm",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3-1.x86_64.rpm",
		},
	},
	"ENT: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.rpm.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3-1.x86_64.rpm.sha256",
		},
	},
	"ENT: Linux ARM64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.rpm",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3-1.aarch64.rpm",
		},
	},
	"ENT: Linux ARM64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.rpm.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3-1.aarch64.rpm.sha256",
		},
	},
	"ENT: Linux ARM7": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.rpm",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3-1.armhfp.rpm",
		},
	},
	"ENT: Linux ARM7 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.rpm.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3-1.armhfp.rpm.sha256",
		},
	},
	"PRO: Linux AMD64": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3-pre.4_102_linux_amd64.rpm",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2-1.2.3~pre.4-1.x86_64.rpm",
		},
	},
	"PRO: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3-pre.4_102_linux_amd64.rpm.sha256",
		output: []string{
			"artifacts/downloads-enterprise2/v1.2.3-pre.4/enterprise2/release/grafana-enterprise2-1.2.3~pre.4-1.x86_64.rpm.sha256",
		},
	},
}
