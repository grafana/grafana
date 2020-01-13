package middleware

import (
	m "github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"
)

// LicensingValidation provides a middleware checking if Grafana is running
// with a license which is not valid.
func LicensingValidation() macaron.Handler {
	return func(c *m.ReqContext) {
		if c.License.HasLicense() && !c.License.HasValidLicense() {

		}
		return
	}
}
