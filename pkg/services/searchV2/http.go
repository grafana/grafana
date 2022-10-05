package searchV2

import (
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"strconv"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/prometheus/client_golang/prometheus"
)

type SearchHTTPService interface {
	RegisterHTTPRoutes(storageRoute routing.RouteRegister)
}

type searchHTTPService struct {
	search    SearchService
	sqlbacked *sqlBackedSearcher
	useSQL    bool
}

func ProvideSearchHTTPService(search SearchService, sql *search.SearchService, folders dashboards.FolderService) SearchHTTPService {
	return &searchHTTPService{
		search: search,
		useSQL: search.IsDisabled(),
		sqlbacked: &sqlBackedSearcher{
			sql:     sql,
			folders: folders,
		},
	}
}

func (s *searchHTTPService) RegisterHTTPRoutes(storageRoute routing.RouteRegister) {
	storageRoute.Post("/", routing.Wrap(s.doQueryFromPOST))
	storageRoute.Get("/", routing.Wrap(s.doQueryFromGET))
}

func (s *searchHTTPService) doQueryFromGET(c *models.ReqContext) response.Response {
	query, err := queryParamsToDashboardQuery(c.Req.URL.Query())
	if err != nil {
		return response.Error(400, "error parsing query", err)
	}
	return s.doQuery(c, query)
}

func (s *searchHTTPService) doQueryFromPOST(c *models.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(500, "error reading bytes", err)
	}

	query := &DashboardQuery{}
	err = json.Unmarshal(body, query)
	if err != nil {
		return response.Error(400, "error parsing query", err)
	}
	return s.doQuery(c, query)
}

func (s *searchHTTPService) doQuery(c *models.ReqContext, query *DashboardQuery) response.Response {
	res := func() *backend.DataResponse {
		if s.useSQL {
			return s.sqlbacked.doSQLQuery(c, query)
		}

		// Check if the bluge index is ready
		searchReadinessCheckResp := s.search.IsReady(c.Req.Context(), c.OrgID)
		if !searchReadinessCheckResp.IsReady {
			// should we rename this?
			dashboardSearchNotServedRequestsCounter.With(prometheus.Labels{
				"reason": searchReadinessCheckResp.Reason,
			}).Inc()

			return s.sqlbacked.doSQLQuery(c, query)
		}

		return s.search.doDashboardQuery(c.Req.Context(), c.SignedInUser, c.OrgID, *query)
	}()

	if res.Error != nil {
		return response.Error(400, "error executing query", res.Error)
	}
	return response.JSON(200, res)
}

// Convert URL parameters to a query object
func queryParamsToDashboardQuery(params url.Values) (*DashboardQuery, error) {
	var err error
	var parseError error
	query := &DashboardQuery{}
	for k, v := range params {
		if len(v) < 1 {
			continue
		}
		switch k {
		case "starred":
			// ignore

		case "query":
			query.Query = v[0]
		case "location":
			query.Location = v[0]
		case "tag":
			query.Tags = v
		case "kind":
			query.Kind = v
		case "from":
			query.From, parseError = strconv.Atoi(v[0])
			if parseError != nil {
				err = parseError
			}
		case "limit":
			query.Limit, parseError = strconv.Atoi(v[0])
			if parseError != nil {
				err = parseError
			}
		default:
			err = fmt.Errorf("unknown query parameter: %s", k)
		}
	}
	return query, err
}
