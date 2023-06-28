package searchaudit

import (
	"net/http"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/audit"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
)

type Service interface {
	SearchAuditRecords(c *contextmodel.ReqContext) response.Response
	SearchAuditRecordsWithPaging(c *contextmodel.ReqContext) response.Response
}

type OSSService struct {
	auditService audit.Service
}

func ProvideAuditRecordsService(auditService audit.Service,
) *OSSService {
	return &OSSService{
		auditService: auditService,
	}
}

// swagger:route GET /audit-records records searchAuditRecords
//
// Get records.
//
// Returns all records that the authenticated user has permission to view, admin permission required.
//
// Responses:
// 200: searchUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError
func (s *OSSService) SearchAuditRecords(c *contextmodel.ReqContext) response.Response {
	result, err := s.SearchAuditRecord(c)
	if err != nil {
		return response.Error(500, "Failed to fetch audit records", err)
	}

	return response.JSON(http.StatusOK, result.AuditRecords)
}

// swagger:route GET /audit-records/search records searchAuditRecordsWithPaging
//
// Get records with paging.
//
// Responses:
// 200: searchUsersResponse
// 401: unauthorisedError
// 403: forbiddenError
// 404: notFoundError
// 500: internalServerError
func (s *OSSService) SearchAuditRecordsWithPaging(c *contextmodel.ReqContext) response.Response {
	result, err := s.SearchAuditRecord(c)
	if err != nil {
		return response.Error(500, "Failed to fetch audit records", err)
	}

	return response.JSON(http.StatusOK, result)
}

func (s *OSSService) SearchAuditRecord(c *contextmodel.ReqContext) (*audit.SearchAuditRecordsQueryResult, error) {
	perPage := c.QueryInt("perpage")
	if perPage <= 0 {
		perPage = 1000
	}
	page := c.QueryInt("page")

	if page < 1 {
		page = 1
	}

	query := &audit.SearchAuditRecordsQuery{
		Page:  page,
		Limit: perPage,
	}
	res, err := s.auditService.Search(c.Req.Context(), query)
	if err != nil {
		return nil, err
	}

	res.Page = page
	res.PerPage = perPage

	return res, nil
}
