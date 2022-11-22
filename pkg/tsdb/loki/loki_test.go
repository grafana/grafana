package loki

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetHeadersForCallResource(t *testing.T) {
	const idTokn1 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
	const idTokn2 = "eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJleHAiOjE2Njg2MjExODQsImlhdCI6MTY2ODYyMTE4NH0.bg0Y0S245DeANhNnnLBCfGYBseTld29O0xynhQwZZlU"
	const authTokn1 = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
	const authTokn2 = "Bearer eyJhbGciOiJIUzI1NiJ9.eyJuYW1lIjoiSm9obiBEb2UiLCJleHAiOjE2Njg2MjExODQsImlhdCI6MTY2ODYyMTE4NH0.bg0Y0S245DeANhNnnLBCfGYBseTld29O0xynhQwZZlU"

	testCases := map[string]struct {
		headers         map[string][]string
		expectedHeaders map[string]string
	}{
		"Headers with empty value": {
			headers: map[string][]string{
				"X-Grafana-Org-Id": {"1"},
				"Cookie":           {""},
				"X-Id-Token":       {""},
				"Accept-Encoding":  {""},
				"Authorization":    {""},
			},
			expectedHeaders: map[string]string{},
		},
		"Headers with multiple values": {
			headers: map[string][]string{
				"Authorization":    {authTokn1, authTokn2},
				"Cookie":           {"a=1"},
				"X-Grafana-Org-Id": {"1"},
				"Accept-Encoding":  {"gzip", "compress"},
				"X-Id-Token":       {idTokn1, idTokn2},
			},
			expectedHeaders: map[string]string{
				"Authorization":   authTokn1,
				"Cookie":          "a=1",
				"Accept-Encoding": "gzip",
				"X-ID-Token":      idTokn1,
			},
		},
		"Headers with single value": {
			headers: map[string][]string{
				"Authorization":    {authTokn1},
				"X-Grafana-Org-Id": {"1"},
				"Cookie":           {"a=1"},
				"Accept-Encoding":  {"gzip"},
				"X-Id-Token":       {idTokn1},
			},
			expectedHeaders: map[string]string{
				"Authorization":   authTokn1,
				"Cookie":          "a=1",
				"Accept-Encoding": "gzip",
				"X-ID-Token":      idTokn1,
			},
		},
		"Non Canonical 'X-Id-Token' header key": {
			headers: map[string][]string{
				"X-ID-TOKEN": {idTokn1},
			},
			expectedHeaders: map[string]string{
				"X-ID-Token": idTokn1,
			},
		},
	}
	for name, test := range testCases {
		t.Run(name, func(t *testing.T) {
			headers := getHeadersForCallResource(test.headers)
			assert.Equal(t, test.expectedHeaders, headers)
		})
	}
}
