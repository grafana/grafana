package util

import (
	"strings"

	"github.com/grafana/grafana/pkg/components/simplejson"
)

const (
	headerName  = "httpHeaderName"
	headerValue = "httpHeaderValue"
)

func CustomHeaders(jsonData *simplejson.Json, decryptedJsonData map[string]string) map[string]string {
	if jsonData == nil {
		return nil
	}

	data := jsonData.MustMap()

	headers := map[string]string{}
	for k := range data {
		if strings.HasPrefix(k, headerName) {
			if header, ok := data[k].(string); ok {
				valueKey := strings.ReplaceAll(k, headerName, headerValue)
				headers[header] = decryptedJsonData[valueKey]
			}
		}
	}

	return headers
}
