package api

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestShortURLAPIEndpoint(t *testing.T) {
	t.Run("Given a correct request for creating a shortUrl", func(t *testing.T) {
		cmd := dtos.CreateShortURLCmd{
			Path: "d/TxKARsmGz/new-dashboard?orgId=1&from=1599389322894&to=1599410922894",
		}

		createResp := &shorturls.ShortUrl{
			Id:    1,
			OrgId: testOrgID,
			Uid:   "N1u6L4eGz",
			Path:  cmd.Path,
		}
		service := &fakeShortURLService{
			createShortURLFunc: func(ctx context.Context, user identity.Requester, cmd *dtos.CreateShortURLCmd) (*shorturls.ShortUrl, error) {
				return createResp, nil
			},
			createConvertShortURLToDTO: func(shortURL *shorturls.ShortUrl, appURL string) *dtos.ShortURL {
				return &dtos.ShortURL{UID: createResp.Uid, URL: "http://localhost:3000/goto/N1u6L4eGz?orgId=1"}
			},
		}

		createShortURLScenario(t, "When calling POST on", "/api/short-urls", "/api/short-urls", cmd, service,
			func(sc *scenarioContext) {
				callCreateShortURL(sc)

				shortUrl := dtos.ShortURL{}
				err := json.NewDecoder(sc.resp.Body).Decode(&shortUrl)
				require.NoError(t, err)
				require.Equal(t, 200, sc.resp.Code)
				require.Equal(t, fmt.Sprintf("http://localhost:3000/goto/%s?orgId=%d", createResp.Uid, createResp.OrgId), shortUrl.URL)
			})
	})

	t.Run("GET /api/short-urls/:uid surfaces non-NotFound errors instead of returning 200 + null", func(t *testing.T) {
		service := &fakeShortURLService{
			getShortURLByUIDFunc: func(ctx context.Context, _ identity.Requester, _ string) (*shorturls.ShortUrl, error) {
				return nil, fmt.Errorf("database unavailable")
			},
		}

		getShortURLScenario(t, "When calling GET on", "/api/short-urls/some-uid", "/api/short-urls/:uid", service,
			func(sc *scenarioContext) {
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, 500, sc.resp.Code)
				require.NotEqual(t, "null", sc.resp.Body.String())
			})
	})

	t.Run("GET /api/short-urls/:uid still returns 404 when the short URL is not found", func(t *testing.T) {
		service := &fakeShortURLService{
			getShortURLByUIDFunc: func(ctx context.Context, _ identity.Requester, _ string) (*shorturls.ShortUrl, error) {
				return nil, shorturls.ErrShortURLNotFound.Errorf("not found")
			},
		}

		getShortURLScenario(t, "When calling GET on", "/api/short-urls/some-uid", "/api/short-urls/:uid", service,
			func(sc *scenarioContext) {
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, 404, sc.resp.Code)
			})
	})

	t.Run("GET /api/short-urls/:uid returns 400 on invalid UID format", func(t *testing.T) {
		service := &fakeShortURLService{}

		getShortURLScenario(t, "When calling GET on", "/api/short-urls/bad%20uid", "/api/short-urls/:uid", service,
			func(sc *scenarioContext) {
				sc.fakeReqWithParams("GET", sc.url, map[string]string{}).exec()

				require.Equal(t, 400, sc.resp.Code)
			})
	})
}

func callCreateShortURL(sc *scenarioContext) {
	sc.fakeReqWithParams("POST", sc.url, map[string]string{}).exec()
}

func createShortURLScenario(t *testing.T, desc string, url string, routePattern string, cmd dtos.CreateShortURLCmd, shortURLService shorturls.Service, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:             setting.NewCfg(),
			ShortURLService: shortURLService,
			log:             log.New("test"),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			c.Req.Body = mockRequestBody(cmd)
			c.Req.Header.Add("Content-Type", "application/json")
			sc.context = c
			sc.context.SignedInUser = &user.SignedInUser{OrgID: testOrgID, UserID: testUserID}

			return hs.createShortURL(c)
		})

		sc.m.Post(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

func getShortURLScenario(t *testing.T, desc string, url string, routePattern string, shortURLService shorturls.Service, fn scenarioFunc) {
	t.Run(fmt.Sprintf("%s %s", desc, url), func(t *testing.T) {
		hs := HTTPServer{
			Cfg:             setting.NewCfg(),
			ShortURLService: shortURLService,
			log:             log.New("test"),
		}

		sc := setupScenarioContext(t, url)
		sc.defaultHandler = routing.Wrap(func(c *contextmodel.ReqContext) response.Response {
			sc.context = c
			sc.context.SignedInUser = &user.SignedInUser{OrgID: testOrgID, UserID: testUserID}

			return hs.getShortURL(c)
		})

		sc.m.Get(routePattern, sc.defaultHandler)

		fn(sc)
	})
}

type fakeShortURLService struct {
	createShortURLFunc         func(ctx context.Context, user identity.Requester, cmd *dtos.CreateShortURLCmd) (*shorturls.ShortUrl, error)
	getShortURLByUIDFunc       func(ctx context.Context, user identity.Requester, uid string) (*shorturls.ShortUrl, error)
	createConvertShortURLToDTO func(shortURL *shorturls.ShortUrl, appURL string) *dtos.ShortURL
}

func (s *fakeShortURLService) List(ctx context.Context, orgID int64) ([]*shorturls.ShortUrl, error) {
	return nil, nil
}

func (s *fakeShortURLService) GetShortURLByUID(ctx context.Context, user identity.Requester, uid string) (*shorturls.ShortUrl, error) {
	if s.getShortURLByUIDFunc != nil {
		return s.getShortURLByUIDFunc(ctx, user, uid)
	}
	return nil, nil
}

func (s *fakeShortURLService) CreateShortURL(ctx context.Context, user identity.Requester, cmd *dtos.CreateShortURLCmd) (*shorturls.ShortUrl, error) {
	if s.createShortURLFunc != nil {
		return s.createShortURLFunc(ctx, user, cmd)
	}

	return nil, nil
}

func (s *fakeShortURLService) UpdateLastSeenAt(ctx context.Context, shortURL *shorturls.ShortUrl) error {
	return nil
}

func (s *fakeShortURLService) DeleteStaleShortURLs(ctx context.Context, cmd *shorturls.DeleteShortUrlCommand) error {
	return nil
}

func (s *fakeShortURLService) ConvertShortURLToDTO(shortURL *shorturls.ShortUrl, appURL string) *dtos.ShortURL {
	if s.createConvertShortURLToDTO != nil {
		return s.createConvertShortURLToDTO(shortURL, appURL)
	}
	return nil
}
