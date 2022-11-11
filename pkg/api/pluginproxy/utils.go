package pluginproxy

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/services/user"
)

// interpolateString accepts template data and return a string with substitutions
func interpolateString(text string, data templateData) (string, error) {
	extraFuncs := map[string]interface{}{
		"orEmpty": func(v interface{}) interface{} {
			if v == nil {
				return ""
			}
			return v
		},
	}

	t, err := template.New("content").Funcs(extraFuncs).Parse(text)
	if err != nil {
		return "", fmt.Errorf("could not parse template %s", text)
	}

	var contentBuf bytes.Buffer
	err = t.Execute(&contentBuf, data)
	if err != nil {
		return "", fmt.Errorf("failed to execute template %s", text)
	}

	return contentBuf.String(), nil
}

// addHeaders interpolates route headers and injects them into the request headers
func addHeaders(reqHeaders *http.Header, route *plugins.Route, data templateData) error {
	for _, header := range route.Headers {
		interpolated, err := interpolateString(header.Content, data)
		if err != nil {
			return err
		}
		reqHeaders.Set(header.Name, interpolated)
	}

	return nil
}

// addQueryString interpolates route params and injects them into the request object
func addQueryString(req *http.Request, route *plugins.Route, data templateData) error {
	q := req.URL.Query()
	for _, param := range route.URLParams {
		interpolatedName, err := interpolateString(param.Name, data)
		if err != nil {
			return err
		}

		interpolatedContent, err := interpolateString(param.Content, data)
		if err != nil {
			return err
		}

		q.Add(interpolatedName, interpolatedContent)
	}
	req.URL.RawQuery = q.Encode()

	return nil
}

func setBodyContent(req *http.Request, route *plugins.Route, data templateData) error {
	if route.Body != nil {
		interpolatedBody, err := interpolateString(string(route.Body), data)
		if err != nil {
			return err
		}

		req.Body = io.NopCloser(strings.NewReader(interpolatedBody))
		req.ContentLength = int64(len(interpolatedBody))
	}

	return nil
}

// Set the X-Grafana-User header if needed (and remove if not)
func applyUserHeader(sendUserHeader bool, req *http.Request, user *user.SignedInUser) {
	req.Header.Del("X-Grafana-User")
	if sendUserHeader && !user.IsAnonymous {
		req.Header.Set("X-Grafana-User", user.Login)
	}
}
