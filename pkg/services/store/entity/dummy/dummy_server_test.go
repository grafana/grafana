package dummy

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"github.com/stretchr/testify/require"
)

func TestRawEncoders(t *testing.T) {
	body, err := json.Marshal(map[string]interface{}{
		"hello": "world",
		"field": 1.23,
	})
	require.NoError(t, err)

	raw := &EntityVersionWithBody{
		&entity.EntityVersionInfo{
			Version: "A",
		},
		body,
	}

	b, err := json.Marshal(raw)
	require.NoError(t, err)

	str := string(b)
	fmt.Printf("expect: %s", str)
	require.JSONEq(t, `{"info":{"version":"A"},"body":"eyJmaWVsZCI6MS4yMywiaGVsbG8iOiJ3b3JsZCJ9"}`, str)

	copy := &EntityVersionWithBody{}
	err = json.Unmarshal(b, copy)
	require.NoError(t, err)
}

func TestRawEntityWithHistory(t *testing.T) {
	body, err := json.Marshal(map[string]interface{}{
		"hello": "world",
		"field": 1.23,
	})
	require.NoError(t, err)

	raw := &EntityWithHistory{
		Entity: &entity.Entity{
			GRN:     &entity.GRN{UID: "x"},
			Version: "A",
			Body:    body,
		},
		History: make([]*EntityVersionWithBody, 0),
	}
	raw.History = append(raw.History, &EntityVersionWithBody{
		&entity.EntityVersionInfo{
			Version: "B",
		},
		body,
	})

	b, err := json.MarshalIndent(raw, "", "  ")
	require.NoError(t, err)

	str := string(b)
	//fmt.Printf("expect: %s", str)
	require.JSONEq(t, `{
		"entity": {
		  "GRN": {
			"UID": "x"
		  },
		  "version": "A",
		  "body": {
			"field": 1.23,
			"hello": "world"
		  }
		},
		"history": [
		  {
			"info": {
			  "version": "B"
			},
			"body": "eyJmaWVsZCI6MS4yMywiaGVsbG8iOiJ3b3JsZCJ9"
		  }
		]
	  }`, str)

	copy := &EntityVersionWithBody{}
	err = json.Unmarshal(b, copy)
	require.NoError(t, err)
}
