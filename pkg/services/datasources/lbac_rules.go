package datasources

import "github.com/grafana/grafana/pkg/components/simplejson"

func CheckTeamHTTPHeadersDiff(currentJsonData *simplejson.Json, newJsonData *simplejson.Json) bool {
	getEncodedString := func(jsonData *simplejson.Json, key string) string {
		if jsonData == nil {
			return ""
		}
		jsonValues, exists := jsonData.CheckGet(key)
		if !exists {
			return ""
		}
		val, _ := jsonValues.Encode()
		return string(val)
	}

	currentTeamHTTPHeaders := getEncodedString(currentJsonData, "teamHttpHeaders")
	newTeamHTTPHeaders := getEncodedString(newJsonData, "teamHttpHeaders")
	if currentTeamHTTPHeaders == "" && newTeamHTTPHeaders == "" {
		return false
	}
	return currentTeamHTTPHeaders != newTeamHTTPHeaders
}
