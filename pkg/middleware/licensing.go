package middleware

import (
	"fmt"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/setting"
	"gopkg.in/macaron.v1"
	"strings"
	"time"
)

const licensingTemplateName = "license-error"

// LicensingValidation provides a middleware checking if Grafana is running
// with a license which is not valid.
func LicensingValidation() macaron.Handler {
	return func(c *m.ReqContext) {
		if c.License.HasLicense() && !c.License.HasValidLicense() {
			invalidLicense(c)
		}
	}
}

func invalidLicense(c *m.ReqContext) {
	// FIXME: Better way to exclude public directories?
	if strings.HasPrefix(c.Req.URL.String(), setting.AppSubUrl+"/public") {
		return
	}

	if c.IsApiRequest() {
		// FIXME: Better error message
		c.JsonApiErr(402, "Invalid License", fmt.Errorf("provided license file is invalid"))
		return
	}

	c.Data["Theme"] = "dark"
	c.Data["AppSubUrl"] = setting.AppSubUrl

	if exp := c.License.Expiry(); exp != 0 {
		expDays := int(time.Since(time.Unix(exp, 0)).Hours() / 24)
		c.Data["ErrorMsg"] = fmt.Sprintf("Your license expired %d days ago.", expDays)
	} else {
		c.Data["ErrorMsg"] = "The license is corrupt or cannot be read by Grafana."
	}

	c.HTML(402, licensingTemplateName)
}
