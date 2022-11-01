package objectdummyserver

import (
	"encoding/json"
	"fmt"
	"testing"

	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/stretchr/testify/require"
)

func TestRawEncoders(t *testing.T) {
	body, err := json.Marshal(map[string]interface{}{
		"hello": "world",
		"field": 1.23,
	})
	require.NoError(t, err)

	raw := &ObjectVersionWithBody{
		&object.ObjectVersionInfo{
			Version: "A",
		},
		body,
	}

	b, err := json.Marshal(raw)
	require.NoError(t, err)

	str := string(b)
	fmt.Printf("expect: %s", str)
	require.JSONEq(t, `{"info":{"version":"A"},"body":"eyJmaWVsZCI6MS4yMywiaGVsbG8iOiJ3b3JsZCJ9"}`, str)

	copy := &ObjectVersionWithBody{}
	err = json.Unmarshal(b, copy)
	require.NoError(t, err)
}

func TestRawObjectWithHistory(t *testing.T) {
	body, err := json.Marshal(map[string]interface{}{
		"hello": "world",
		"field": 1.23,
	})
	require.NoError(t, err)

	raw := &RawObjectWithHistory{
		Object: &object.RawObject{
			GRN:     &object.GRN{UID: "x"},
			Version: "A",
			Body:    body,
		},
		History: make([]*ObjectVersionWithBody, 0),
	}
	raw.History = append(raw.History, &ObjectVersionWithBody{
		&object.ObjectVersionInfo{
			Version: "B",
		},
		body,
	})

	b, err := json.MarshalIndent(raw, "", "  ")
	require.NoError(t, err)

	str := string(b)
	//fmt.Printf("expect: %s", str)
	require.JSONEq(t, `{
		"object": {
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

	copy := &ObjectVersionWithBody{}
	err = json.Unmarshal(b, copy)
	require.NoError(t, err)
}
