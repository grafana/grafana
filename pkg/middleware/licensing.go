package middleware

import (
	"fmt"
	"github.com/grafana/grafana/pkg/models"
	"gopkg.in/macaron.v1"
	"net/http"
)

// LicensingValidation provides a middleware checking if Grafana is running
// with a license which is not valid.
func LicensingValidation(license models.Licensing) macaron.Handler {
	return func(c *models.ReqContext) {
		if c.License == nil {
			c.License = license
		}

		if c.License.HasLicense() && !c.License.HasValidLicense() {
			invalidLicense(c)
		}
	}
}

func invalidLicense(c *models.ReqContext) {
	// FIXME: Better error message
	c.JsonApiErr(http.StatusForbidden, "Invalid License", fmt.Errorf("provided license file is invalid"))
	return
}
