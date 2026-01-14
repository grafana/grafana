package app

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"strconv"

	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/app"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type GetTeamsHandler struct {
	log      log.Logger
	client   resourcepb.ResourceIndexClient
	tracer   trace.Tracer
	features featuremgmt.FeatureToggles
}

func NewGetTeamsHandler(tracer trace.Tracer, dual dualwrite.Service, legacyTeamSearcher resourcepb.ResourceIndexClient, resourceClient resource.ResourceClient, features featuremgmt.FeatureToggles) *GetTeamsHandler {
	searchClient := resource.NewSearchClient(dualwrite.NewSearchAdapter(dual), iamv0alpha1.TeamBindingResourceInfo.GroupResource(), resourceClient, legacyTeamSearcher, features)

	return &GetTeamsHandler{
		client:   searchClient,
		log:      log.New("grafana-apiserver.teams.search"),
		tracer:   tracer,
		features: features,
	}
}

func (h *GetTeamsHandler) Handle(ctx context.Context, writer app.CustomRouteResponseWriter, request *app.CustomRouteRequest) error {
	ctx, span := h.tracer.Start(ctx, "user.teams")
	defer span.End()

	queryParams, err := url.ParseQuery(request.URL.RawQuery)
	if err != nil {
		return err
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return fmt.Errorf("no identity found for request: %w", err)
	}

	limit := 50
	offset := 0
	page := 1
	if queryParams.Has("limit") {
		limit, _ = strconv.Atoi(queryParams.Get("limit"))
	}
	if queryParams.Has("offset") {
		offset, _ = strconv.Atoi(queryParams.Get("offset"))
		if offset > 0 {
			page = (offset / limit) + 1
		}
	} else if queryParams.Has("page") {
		page, _ = strconv.Atoi(queryParams.Get("page"))
		offset = (page - 1) * limit
	}

	searchRequest := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Group:     iamv0alpha1.TeamBindingResourceInfo.GroupResource().Group,
				Resource:  iamv0alpha1.TeamBindingResourceInfo.GroupResource().Resource,
				Namespace: requester.GetNamespace(),
			},
		},
		Limit:   int64(limit),
		Offset:  int64(offset),
		Page:    int64(page),
		Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
		Fields: []string{
			resource.SEARCH_FIELD_PREFIX + "teamRef.name",
			resource.SEARCH_FIELD_PREFIX + "permission",
			resource.SEARCH_FIELD_PREFIX + "external",
		},
	}

	result, err := h.client.Search(ctx, searchRequest)
	if err != nil {
		return err
	}

	searchResults, err := h.parseResults(result, searchRequest.Offset)
	if err != nil {
		return err
	}

	if err := json.NewEncoder(writer).Encode(searchResults); err != nil {
		return err
	}

	return nil
}

func (h *GetTeamsHandler) parseResults(result *resourcepb.ResourceSearchResponse, offset int64) (iamv0alpha1.GetTeamsBody, error) {
	if result == nil {
		return iamv0alpha1.GetTeamsBody{}, nil
	} else if result.Error != nil {
		return iamv0alpha1.GetTeamsBody{}, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	} else if result.Results == nil {
		return iamv0alpha1.GetTeamsBody{}, nil
	}

	teamRefIDX := -1
	permissionIDX := -1
	externalIDX := -1

	for i, v := range result.Results.Columns {
		if v == nil {
			continue
		}

		switch v.Name {
		case "teamRef.name":
			teamRefIDX = i
		case "permission":
			permissionIDX = i
		case "external":
			externalIDX = i
		}
	}

	body := iamv0alpha1.GetTeamsBody{
		Items: make([]iamv0alpha1.VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		if len(row.Cells) != len(result.Results.Columns) {
			return iamv0alpha1.GetTeamsBody{}, fmt.Errorf("error parsing team binding response: mismatch number of columns and cells")
		}

		body.Items[i] = iamv0alpha1.VersionsV0alpha1Kinds6RoutesTeamsGETResponseUserTeam{
			TeamRef:    iamv0alpha1.TeamRef{Name: string(row.Cells[teamRefIDX])},
			Permission: iamv0alpha1.TeamPermission(string(row.Cells[permissionIDX])),
			External:   string(row.Cells[externalIDX]) == "true",
		}
	}

	return body, nil
}
