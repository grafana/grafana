package api

import "encoding/json"

func jsonMap(data []byte) (map[string]string, error) {
	jsonMap := make(map[string]string)
	err := json.Unmarshal(data, &jsonMap)
	return jsonMap, err
}
