package pluginproxy

import (
	"net/http"
	"net/url"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	. "github.com/smartystreets/goconvey/convey"
)

func TestSessionToken(t *testing.T) {
	Convey("Plugin with token auth route", t, func() {
		pluginRoute := &plugins.AppPluginRoute{
			Path:   "pathwithtoken",
			Url:    "https://api.example.io/some/path",
			Method: "GET",
			TokenAuth: &plugins.JwtTokenAuth{
				Url: "{{.JsonData.logInsightHost}}/api/v1/sessions",
				Params: map[string]string{
					"username":   "{{.JsonData.username}}",
					"password":   "{{.SecureJsonData.password}}",
					"tokenField": "{{.JsonData.tokenField}}",
				},
			},
		}

		templateData := templateData{
			JsonData: map[string]interface{}{
				"username":       "user",
				"logInsightHost": "http://localhost:8080",
			},
			SecureJsonData: map[string]string{
				"password": "password",
			},
		}

		ds := &models.DataSource{Id: 1, Version: 2}

		Convey("should fetch token using username and password", func() {
			getOpaqueTokenSource = func(urlInterpolated string, params url.Values, client *http.Client) (opaqueToken, error) {
				return opaqueToken{time.Now(),
					time.Now().String(),
					"abc",
					"user",
					1800}, nil
			}
			provider := newOpaqueTokenProvider(ds, pluginRoute)

			// doesn't matter what httpClient is, mock this later
			token, err := provider.getOpaqueToken(templateData, nil)
			So(err, ShouldBeNil)

			So(token, ShouldEqual, "abc")
		})

	})
}
