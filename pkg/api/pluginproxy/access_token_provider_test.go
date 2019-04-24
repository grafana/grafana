package pluginproxy

import (
	"context"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	. "github.com/smartystreets/goconvey/convey"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/jwt"
)

func TestAccessToken(t *testing.T) {
	Convey("Plugin with JWT token auth route", t, func() {
		pluginRoute := &plugins.AppPluginRoute{
			Path:   "pathwithjwttoken1",
			Url:    "https://api.jwt.io/some/path",
			Method: "GET",
			JwtTokenAuth: &plugins.JwtTokenAuth{
				Url: "https://login.server.com/{{.JsonData.tenantId}}/oauth2/token",
				Scopes: []string{
					"https://www.testapi.com/auth/monitoring.read",
					"https://www.testapi.com/auth/cloudplatformprojects.readonly",
				},
				Params: map[string]string{
					"token_uri":    "{{.JsonData.tokenUri}}",
					"client_email": "{{.JsonData.clientEmail}}",
					"private_key":  "{{.SecureJsonData.privateKey}}",
				},
			},
		}

		templateData := templateData{
			JsonData: map[string]interface{}{
				"clientEmail": "test@test.com",
				"tokenUri":    "login.url.com/token",
			},
			SecureJsonData: map[string]string{
				"privateKey": "testkey",
			},
		}

		ds := &models.DataSource{Id: 1, Version: 2}

		Convey("should fetch token using jwt private key", func() {
			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				return &oauth2.Token{AccessToken: "abc"}, nil
			}
			provider := newAccessTokenProvider(ds, pluginRoute)
			token, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)

			So(token, ShouldEqual, "abc")
		})

		Convey("should set jwt config values", func() {
			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				So(conf.Email, ShouldEqual, "test@test.com")
				So(conf.PrivateKey, ShouldResemble, []byte("testkey"))
				So(len(conf.Scopes), ShouldEqual, 2)
				So(conf.Scopes[0], ShouldEqual, "https://www.testapi.com/auth/monitoring.read")
				So(conf.Scopes[1], ShouldEqual, "https://www.testapi.com/auth/cloudplatformprojects.readonly")
				So(conf.TokenURL, ShouldEqual, "login.url.com/token")

				return &oauth2.Token{AccessToken: "abc"}, nil
			}

			provider := newAccessTokenProvider(ds, pluginRoute)
			_, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)
		})

		Convey("should use cached token on second call", func() {
			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				return &oauth2.Token{
					AccessToken: "abc",
					Expiry:      time.Now().Add(1 * time.Minute)}, nil
			}
			provider := newAccessTokenProvider(ds, pluginRoute)
			token1, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)
			So(token1, ShouldEqual, "abc")

			getTokenSource = func(conf *jwt.Config, ctx context.Context) (*oauth2.Token, error) {
				return &oauth2.Token{AccessToken: "error: cache not used"}, nil
			}
			token2, err := provider.getJwtAccessToken(context.Background(), templateData)
			So(err, ShouldBeNil)
			So(token2, ShouldEqual, "abc")
		})
	})
}
