package main

var msiMapping = map[string]m{
	"ENT": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_windows_amd64.msi",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.windows-amd64.msi",
		},
	},
	"ENT SHA256": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_windows_amd64.msi.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/enterprise/release/grafana-enterprise-1.2.3.windows-amd64.msi.sha256",
		},
	},
	"OSS": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_windows_amd64.msi",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.windows-amd64.msi",
		},
	},
	"OSS SHA256": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_windows_amd64.msi.sha256",
		output: []string{
			"artifacts/downloads/v1.2.3/oss/release/grafana-1.2.3.windows-amd64.msi.sha256",
		},
	},
}
