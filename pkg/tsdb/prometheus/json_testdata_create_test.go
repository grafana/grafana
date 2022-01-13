package prometheus

import (
	"encoding/json"
	"testing"
	"time"
)

func TestJsonTestdataCreate(t *testing.T) {
	now := time.Now().Unix()
	bytes, query := createJsonTestData(now, 1, 4, 1)

	// we will unmarshal it,
	// to test that it is valid JSON
	var d interface{}
	err := json.Unmarshal(bytes, &d)
	if err != nil {
		t.Error(err)
	}

	// now we marshal it to byte[] again,
	// and compare the length of the result
	// to the original.
	// (the bytes will not be equal,
	// because the order of JSON fields
	// will change. but we want to have
	// it the way Prometheus has them).
	bytes2, err := json.Marshal(d)
	if err != nil {
		t.Error(err)
	}

	// we check if the timestamp of the last item in the first series
	// matches query.End
	// this is quite ugly code, because the data is unstructured
	seriesList := d.(map[string]interface{})["data"].(map[string]interface{})["result"].([]interface{})
	values := seriesList[0].(map[string]interface{})["values"].([]interface{})
	lastValue := values[len(values)-1].([]interface{})
	timestampFloat := lastValue[0].(float64)

	if int64(timestampFloat) != query.End.Unix() {
		t.Errorf("aaaaa")
	}

	if len(bytes) != len(bytes2) {
		t.Errorf("re-marshaled json length differs")
	}
}
