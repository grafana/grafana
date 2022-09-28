package searchV2

import (
	"encoding/json"
	"errors"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana/pkg/api/apierrors"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/api/routing"
	"github.com/grafana/grafana/pkg/middleware"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/search"
	"github.com/grafana/grafana/pkg/services/store/object"
	"github.com/prometheus/client_golang/prometheus"
)

type SearchHTTPService interface {
	RegisterHTTPRoutes(storageRoute routing.RouteRegister)
}

type searchHTTPService struct {
	search  SearchService
	sql     *search.SearchService
	folders dashboards.FolderService
}

func ProvideSearchHTTPService(search SearchService, sql *search.SearchService, folders dashboards.FolderService) SearchHTTPService {
	return &searchHTTPService{
		search:  search,
		sql:     sql,
		folders: folders,
	}
}

func (s *searchHTTPService) RegisterHTTPRoutes(storageRoute routing.RouteRegister) {
	storageRoute.Post("/", middleware.ReqSignedIn, routing.Wrap(s.doQuery))
}

func (s *searchHTTPService) doQuery(c *models.ReqContext) response.Response {
	body, err := io.ReadAll(c.Req.Body)
	if err != nil {
		return response.Error(500, "error reading bytes", err)
	}

	query := &DashboardQuery{}
	err = json.Unmarshal(body, query)
	if err != nil {
		return response.Error(400, "error parsing body", err)
	}

	var resp *backend.DataResponse
	if true { // The dashboard only SQL flavor... fallback when not enabled?
		q := &search.Query{
			OrgId:        c.OrgID,
			SignedInUser: c.SignedInUser,
		}
		if query.Query != "*" {
			q.Title = query.Query
		}
		// Limit to only folders
		if len(query.Kind) == 1 && query.Kind[0] == object.StandardKindFolder {
			q.Type = string(models.DashHitFolder)
		}

		// Lookup folder ID from the UID
		if query.Location == "general" {
			q.FolderIds = append(q.FolderIds, 0) // the root folder
			q.Type = string(models.DashHitDB)
		} else if query.Location != "" {
			folder, err := s.folders.GetFolderByUID(c.Req.Context(), c.SignedInUser, c.OrgID, query.Location)
			if err != nil {
				return apierrors.ToFolderErrorResponse(err)
			}
			q.FolderIds = append(q.FolderIds, folder.Id)
		}

		err = s.sql.SearchHandler(c.Req.Context(), q)
		if err != nil {
			return response.Error(500, "error running query", err)
		}
		resp = &backend.DataResponse{
			Frames: data.Frames{
				hitListToFrame(q.Result),
			},
		}
	} else {
		searchReadinessCheckResp := s.search.IsReady(c.Req.Context(), c.OrgID)
		if !searchReadinessCheckResp.IsReady {
			dashboardSearchNotServedRequestsCounter.With(prometheus.Labels{
				"reason": searchReadinessCheckResp.Reason,
			}).Inc()

			bytes, err := (&data.Frame{
				Name: "Loading",
			}).MarshalJSON()

			if err != nil {
				return response.Error(500, "error marshalling response", err)
			}
			return response.JSON(200, bytes)
		}
		resp = s.search.doDashboardQuery(c.Req.Context(), c.SignedInUser, c.OrgID, *query)
	}

	if resp.Error != nil {
		return response.Error(500, "error handling search request", resp.Error)
	}

	if len(resp.Frames) == 0 {
		msg := "invalid search response"
		return response.Error(500, msg, errors.New(msg))
	}

	bytes, err := resp.MarshalJSON()
	if err != nil {
		return response.Error(500, "error marshalling response", err)
	}

	return response.JSON(200, bytes)
}

// This converts the HitList to the same shape as returnd from the search query
func hitListToFrame(hits models.HitList) *data.Frame {
	if hits == nil {
		hits = make(models.HitList, 0)
	}
	count := len(hits)

	header := &customMeta{
		Count:     uint64(count),
		Locations: make(map[string]locationItem),
	}
	if count > 0 {
		header.SortBy = hits[0].SortMetaName
	}

	fScore := data.NewFieldFromFieldType(data.FieldTypeFloat64, count)
	fUID := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fKind := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fPType := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fName := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fURL := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fLocation := data.NewFieldFromFieldType(data.FieldTypeString, count)
	fTags := data.NewFieldFromFieldType(data.FieldTypeNullableJSON, count)
	fDSUIDs := data.NewFieldFromFieldType(data.FieldTypeJSON, count)

	fScore.Name = "score"
	fUID.Name = "uid"
	fKind.Name = "kind"
	fName.Name = "name"
	fLocation.Name = "location"
	fURL.Name = "url"
	fURL.Config = &data.FieldConfig{
		Links: []data.DataLink{
			{Title: "link", URL: "${__value.text}"},
		},
	}
	fPType.Name = "panel_type"
	fDSUIDs.Name = "ds_uid"
	fTags.Name = "tags"

	frame := data.NewFrame("Query results", fKind, fUID, fName, fPType, fURL, fTags, fDSUIDs, fLocation)
	frame.SetMeta(&data.FrameMeta{
		Type:   "search-results",
		Custom: header,
	})

	for i, hit := range hits {
		fUID.SetConcrete(i, hit.UID)
		fName.SetConcrete(i, hit.Title)
		fURL.SetConcrete(i, hit.URL)
		if hit.Type == models.DashHitFolder {
			fKind.SetConcrete(i, object.StandardKindFolder)
		} else {
			fKind.SetConcrete(i, object.StandardKindDashboard)
		}

		if len(hit.Tags) > 0 {
			msg, _ := json.Marshal(hit.Tags)
			fTags.SetConcrete(i, json.RawMessage(msg))
		}

		// Add location info
		fuid := hit.FolderUID
		if fuid == "" {
			fuid = "general"
			header.Locations[fuid] = locationItem{
				Kind: object.StandardKindFolder,
				Name: "General",
				URL:  "/dashboards",
			}
		}
		if header.Locations[fuid].Kind == "" { // missing
			header.Locations[fuid] = locationItem{
				Kind: object.StandardKindFolder,
				Name: hit.FolderTitle,
				URL:  hit.FolderURL,
			}
		}
		fLocation.SetConcrete(i, fuid)
	}

	return frame
}
