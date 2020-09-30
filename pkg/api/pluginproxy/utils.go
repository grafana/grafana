package pluginproxy

import (
	"bytes"
	"fmt"
	"net/http"
	"text/template"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
)

// InterpolateString accepts template data and return a string with substitutions
func InterpolateString(text string, data templateData) (string, error) {
	t, err := template.New("content").Parse(text)
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

// AddHeaders interpolates route headers and injects them into the request headers
func AddHeaders(reqHeaders *http.Header, route *plugins.AppPluginRoute, data templateData) error {
	for _, header := range route.Headers {
		interpolated, err := InterpolateString(header.Content, data)
		if err != nil {
			return err
		}
		reqHeaders.Set(header.Name, interpolated)
	}

	return nil
}

// AddQueryString interpolates route params and injects them into the request object
func AddQueryString(req *http.Request, route *plugins.AppPluginRoute, data templateData) error {
	q := req.URL.Query()
	for _, param := range route.URLParams {
		interpolatedName, err := InterpolateString(param.Name, data)
		if err != nil {
			return err
		}

		interpolatedContent, err := InterpolateString(param.Content, data)
		if err != nil {
			return err
		}

		q.Add(interpolatedName, interpolatedContent)
	}
	req.URL.RawQuery = q.Encode()

	return nil
}

// Set the X-Grafana-User header if needed (and remove if not)
func applyUserHeader(sendUserHeader bool, req *http.Request, user *models.SignedInUser) {
	req.Header.Del("X-Grafana-User")
	if sendUserHeader && !user.IsAnonymous {
		req.Header.Set("X-Grafana-User", user.Login)
	}
}
