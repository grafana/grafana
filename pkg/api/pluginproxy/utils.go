package pluginproxy

import (
	"bytes"
	"fmt"
	"net/http"
	"text/template"

	"github.com/grafana/grafana/pkg/models"
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

// Set the X-Grafana-User header if needed (and remove if not)
func applyUserHeader(sendUserHeader bool, req *http.Request, user *models.SignedInUser) {
	req.Header.Del("X-Grafana-User")
	if sendUserHeader && !user.IsAnonymous {
		req.Header.Set("X-Grafana-User", user.Login)
	}
}
