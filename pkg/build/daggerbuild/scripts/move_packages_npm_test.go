package main

var npmMapping = map[string]m{
	"Grafana data": {
		input: "file://dist/tag/grafana-10.2.0-pre/npm-artifacts",
		output: []string{
			"artifacts/npm/v10.2.0-pre/npm-artifacts",
		},
		env: map[string]string{"DRONE_TAG": "10.2.0-pre"},
	},
}
