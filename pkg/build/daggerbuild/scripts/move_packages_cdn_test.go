package main

var cdnMapping = map[string]m{
	"OSS: Linux AMD64": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64/public",
		output: []string{
			"artifacts/static-assets/grafana/1.2.3/public",
		},
		env: map[string]string{"DRONE_TAG": "1.2.3"},
	},
	"ENT: Linux AMD64": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64/public",
		output: []string{
			"artifacts/static-assets/grafana/1.2.3/public",
		},
		env: map[string]string{"DRONE_TAG": "1.2.3"},
	},
	"PRO: Linux AMD64": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_amd64/public",
		output: []string{
			"artifacts/static-assets/grafana/1.2.3/public",
		},
		env: map[string]string{"DRONE_TAG": "1.2.3"},
	},
	"main": {
		input: "dist/10.3.0-62960/grafana-enterprise/public",
		output: []string{
			"grafana/10.3.0-62960/public",
		},
		env: map[string]string{"IS_MAIN": "true"},
	},
}
