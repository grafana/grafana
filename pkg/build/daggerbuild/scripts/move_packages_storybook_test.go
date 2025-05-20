package main

var storybookMapping = map[string]m{
	"OSS": {
		input: "gs://bucket/tag/grafana_v1.2.3_102_linux_amd64/storybook",
		output: []string{
			"artifacts/storybook/v1.2.3",
		},
		env: map[string]string{"DRONE_TAG": "1.2.3"},
	},
	"ENT": {
		input: "gs://bucket/tag/grafana-enterprise_v1.2.3_102_linux_amd64/storybook",
		output: []string{
			"artifacts/storybook/v1.2.3",
		},
		env: map[string]string{"DRONE_TAG": "1.2.3"},
	},
	"PRO": {
		input: "gs://bucket/tag/grafana-pro_v1.2.3_102_linux_amd64/storybook",
		output: []string{
			"artifacts/storybook/v1.2.3",
		},
		env: map[string]string{"DRONE_TAG": "1.2.3"},
	},
}
