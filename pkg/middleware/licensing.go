package middleware

import (
	"fmt"

	m "github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"
)

const licensingTemplateName = "license-error"

// LicensingValidation provides a middleware checking if Grafana is running with a license which is not valid.
func LicensingValidation() macaron.Handler {
	return func(c *m.ReqContext) {
		// This filter only applies to api calls
		if !c.IsApiRequest() {
			return
		}

		// TODO needs better message, for expired: The Grafana Enterprise license has expired
		// For invalid: The Grafana Enterprise license is not valid
		if c.License.HasLicense() && !c.License.HasValidLicense() {
			c.JsonApiErr(402, "Invalid License", fmt.Errorf("provided license file is invalid"))
		}
	}
}
