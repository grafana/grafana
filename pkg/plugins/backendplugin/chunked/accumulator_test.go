package chunked

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestAccumulator(t *testing.T) {
	rsp, err := AccumulateJSONLines(strings.NewReader(`
	 {"refId":"A","frameId":"f0","frame":{"schema":{"refId":"A","fields":[{"name":"f1","type":"number","typeInfo":{"frame":"int64","nullable":true}},{"name":"f2","type":"string","typeInfo":{"frame":"string","nullable":true}},{"name":"f3","type":"boolean","typeInfo":{"frame":"bool","nullable":true}}]},"data":{"values":[[1],["two"],[false]]}}}
	`))
	require.NoError(t, err)

	out, err := json.MarshalIndent(rsp, "", "  ")
	// fmt.Printf("%s\n", out)
	require.NoError(t, err)
	require.JSONEq(t, `{
		"results": {
			"A": {
				"status": 200,
				"frames": [
					{
						"schema": {
							"refId": "A",
							"fields": [
								{
									"name": "f1",
									"type": "number",
									"typeInfo": {
										"frame": "int64",
										"nullable": true
									}
								},
								{
									"name": "f2",
									"type": "string",
									"typeInfo": {
										"frame": "string",
										"nullable": true
									}
								},
								{
									"name": "f3",
									"type": "boolean",
									"typeInfo": {
										"frame": "bool",
										"nullable": true
									}
								}
							]
						},
						"data": {
							"values": [
								[ 1 ], [ "two" ], [ false ]
							]
						}
					}
				]
			}
		}
	}`, string(out))
}
