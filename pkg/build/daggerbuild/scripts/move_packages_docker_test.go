package main

var dockerMapping = map[string]m{
	"ENT: Linux AMD64 Ubuntu": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-ubuntu-amd64.img",
		},
	},
	"ENT: Linux AMD64 Ubuntu SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.ubuntu.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-ubuntu-amd64.img.sha256",
		},
	},
	"ENT: Linux ARM64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-arm64.img",
		},
	},
	"ENT: Linux ARM64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-arm64.img.sha256",
		},
	},
	"ENT: Linux ARM7": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-armv7.img",
		},
	},
	"ENT: Linux ARM7 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-armv7.img.sha256",
		},
	},
	"ENT: Linux ARM7 Ubuntu": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-ubuntu-armv7.img",
		},
	},
	"ENT: Linux AR7 Ubuntu SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm-7.ubuntu.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-ubuntu-armv7.img.sha256",
		},
	},
	"ENT: Linux AMD64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-amd64.img",
		},
	},
	"ENT: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-amd64.img.sha256",
		},
	},
	"ENT: Linux ARM64 Ubuntu": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-ubuntu-arm64.img",
		},
	},
	"ENT: Linux ARM64 Ubuntu SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_arm64.ubuntu.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise-1.2.3-ubuntu-arm64.img.sha256",
		},
	},
	"OSS: Linux ARM7": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-armv7.img",
		},
	},
	"OSS: Linux ARM7 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-armv7.img.sha256",
		},
	},
	"OSS: Linux ARM7 Ubuntu": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-ubuntu-armv7.img",
		},
	},
	"OSS: Linux AR7 Ubuntu SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm-7.ubuntu.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-ubuntu-armv7.img.sha256",
		},
	},
	"OSS: Linux AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-amd64.img",
		},
	},
	"OSS: Linux AMD64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-amd64.img.sha256",
		},
	},
	"OSS: Linux AMD64 Ubuntu": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-ubuntu-amd64.img",
		},
	},
	"OSS: Linux AMD64 Ubuntu SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64.ubuntu.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-ubuntu-amd64.img.sha256",
		},
	},
	"OSS: Linux ARM64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-arm64.img",
		},
	},
	"OSS: Linux ARM64 SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-arm64.img.sha256",
		},
	},
	"OSS: Linux ARM64 Ubuntu": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-ubuntu-arm64.img",
		},
	},
	"OSS: Linux ARM64 Ubuntu SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_arm64.ubuntu.docker.tar.gz.sha256",
		output: []string{
			"artifacts/docker/1.2.3/grafana-oss-1.2.3-ubuntu-arm64.img.sha256",
		},
	},
	"PRO: Linux AMD64": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_amd64.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise2-1.2.3-amd64.img",
		},
	},
	"PRO: Linux ARM64": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_arm64.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise2-1.2.3-arm64.img",
		},
	},
	"PRO: Linux ARM7": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_arm-7.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise2-1.2.3-armv7.img",
		},
	},
	"PRO: Linux AMD64 Ubuntu": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_amd64.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise2-1.2.3-ubuntu-amd64.img",
		},
	},
	"PRO: Linux ARM64 Ubuntu": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_arm64.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise2-1.2.3-ubuntu-arm64.img",
		},
	},
	"PRO: Linux ARM7 Ubuntu": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_arm-7.ubuntu.docker.tar.gz",
		output: []string{
			"artifacts/docker/1.2.3/grafana-enterprise2-1.2.3-ubuntu-armv7.img",
		},
	},
}
