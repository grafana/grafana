package searchV2

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/registry"
	"github.com/grafana/grafana/pkg/services/user"
)

type FacetField struct {
	Field string `json:"field"`
	Limit int    `json:"limit,omitempty"` // explicit page size
}

type DashboardQuery struct {
	Query              string       `json:"query"`
	Location           string       `json:"location,omitempty"` // parent folder ID
	Sort               string       `json:"sort,omitempty"`     // field ASC/DESC
	Datasource         string       `json:"ds_uid,omitempty"`   // "datasource" collides with the JSON value at the same leel :()
	DatasourceType     string       `json:"ds_type,omitempty"`
	Tags               []string     `json:"tags,omitempty"`
	Kind               []string     `json:"kind,omitempty"`
	PanelType          string       `json:"panel_type,omitempty"`
	UIDs               []string     `json:"uid,omitempty"`
	Explain            bool         `json:"explain,omitempty"`            // adds details on why document matched
	WithAllowedActions bool         `json:"withAllowedActions,omitempty"` // adds allowed actions per entity
	Facet              []FacetField `json:"facet,omitempty"`
	SkipLocation       bool         `json:"skipLocation,omitempty"`
	HasPreview         string       `json:"hasPreview,omitempty"` // the light|dark theme
	Limit              int          `json:"limit,omitempty"`      // explicit page size
	From               int          `json:"from,omitempty"`       // for paging
}

type IsSearchReadyResponse struct {
	IsReady bool
	Reason  string // initial-indexing-ongoing, org-indexing-ongoing
}

//go:generate mockery --name SearchService --structname MockSearchService --inpackage --filename search_service_mock.go
type SearchService interface {
	registry.CanBeDisabled
	registry.BackgroundService
	DoDashboardQuery(ctx context.Context, user *backend.User, orgId int64, query DashboardQuery) *backend.DataResponse
	doDashboardQuery(ctx context.Context, user *user.SignedInUser, orgId int64, query DashboardQuery) *backend.DataResponse
	IsReady(ctx context.Context, orgId int64) IsSearchReadyResponse
	RegisterDashboardIndexExtender(ext DashboardIndexExtender)
	TriggerReIndex()
}
