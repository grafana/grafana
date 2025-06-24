package main

var exeMapping = map[string]m{
	"ENT": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_windows_amd64.exe",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.windows-amd64.exe",
		},
	},
	"ENT SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_windows_amd64.exe.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.windows-amd64.exe.sha256",
		},
	},
	"OSS": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_windows_amd64.exe",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.windows-amd64.exe",
		},
	},
	"OSS SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_windows_amd64.exe.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.windows-amd64.exe.sha256",
		},
	},
}
