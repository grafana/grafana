package main

var zipMapping = map[string]m{
	"OSS: Windows AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3-test.1_102_windows_amd64.zip",
		output: []string{
			"artifacts/downloads/v1.2.3-test.1/oss/release/grafana-1.2.3-test.1.windows-amd64.zip",
		},
	},
	"OSS: Windows AMD64 from file://": {
		input: "file://bucket/tag/grafana_v1.2.3-test.1_102_windows_amd64.zip",
		output: []string{
			"artifacts/downloads/v1.2.3-test.1/oss/release/grafana-1.2.3-test.1.windows-amd64.zip",
		},
	},
	"OSS: Windows AMD64 main from file://": {
		input: "file://bucket/tag/grafana_main_102_windows_amd64.zip",
		output: []string{
			"artifacts/downloads/main/oss/release/grafana-main.windows-amd64.zip",
		},
	},
}
