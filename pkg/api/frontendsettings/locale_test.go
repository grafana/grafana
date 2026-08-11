package frontendsettings

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

func TestLocaleFromRequest(t *testing.T) {
	tests := []struct {
		name           string
		acceptLanguage string
		expected       string
	}{
		{
			name:           "no header falls back to the default",
			acceptLanguage: "",
			expected:       "en-US",
		},
		{
			name:           "single tag",
			acceptLanguage: "en-GB",
			expected:       "en-GB",
		},
		{
			name:           "most preferred tag wins",
			acceptLanguage: "en-GB,en-US;q=0.9,en;q=0.8",
			expected:       "en-GB",
		},
		{
			name:           "quality values order the tags, not their position",
			acceptLanguage: "en-US;q=0.5,de-DE;q=0.9",
			expected:       "de-DE",
		},
		{
			name:           "quality value is not part of the tag",
			acceptLanguage: "en-GB;q=0.9,de;q=0.8",
			expected:       "en-GB",
		},
		{
			name:           "tags are canonicalised",
			acceptLanguage: "EN-gb",
			expected:       "en-GB",
		},
		{
			name:           "wildcard falls back to the default",
			acceptLanguage: "*",
			expected:       "en-US",
		},
		{
			name:           "malformed header falls back to the default",
			acceptLanguage: "not a language tag",
			expected:       "en-US",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &http.Request{Header: http.Header{}}
			if tt.acceptLanguage != "" {
				req.Header.Set("Accept-Language", tt.acceptLanguage)
			}

			assert.Equal(t, tt.expected, LocaleFromRequest(req))
		})
	}
}

func TestLocaleFromRequestNilRequest(t *testing.T) {
	assert.Equal(t, "en-US", LocaleFromRequest(nil))
}

func TestLocaleFromReqContext(t *testing.T) {
	t.Run("reads the header from the request", func(t *testing.T) {
		req := &http.Request{Header: http.Header{}}
		req.Header.Set("Accept-Language", "de-DE,en;q=0.9")

		reqCtx := &contextmodel.ReqContext{Context: &web.Context{Req: req}}

		assert.Equal(t, "de-DE", localeFromReqContext(reqCtx))
	})

	t.Run("falls back to the default without a request", func(t *testing.T) {
		assert.Equal(t, "en-US", localeFromReqContext(nil))
		assert.Equal(t, "en-US", localeFromReqContext(&contextmodel.ReqContext{}))
		assert.Equal(t, "en-US", localeFromReqContext(&contextmodel.ReqContext{Context: &web.Context{}}))
	})
}
