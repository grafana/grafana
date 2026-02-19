package team

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"

	"go.opentelemetry.io/otel/trace"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/selection"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/authlib/types"
	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iamv0 "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

var (
	_ rest.Storage         = (*TeamMembersREST)(nil)
	_ rest.Scoper          = (*TeamMembersREST)(nil)
	_ rest.StorageMetadata = (*TeamMembersREST)(nil)
	_ rest.Connecter       = (*TeamMembersREST)(nil)
)

func NewTeamMembersREST(client resourcepb.ResourceIndexClient, tracer trace.Tracer, features featuremgmt.FeatureToggles,
	accessClient types.AccessClient) *TeamMembersREST {
	return &TeamMembersREST{
		log:          log.New("grafana-apiserver.team.members"),
		client:       client,
		tracer:       tracer,
		features:     features,
		accessClient: accessClient,
	}
}

type TeamMembersREST struct {
	accessClient types.AccessClient
	log          log.Logger
	client       resourcepb.ResourceIndexClient
	tracer       trace.Tracer
	features     featuremgmt.FeatureToggles
}

// New implements rest.Storage.
func (s *TeamMembersREST) New() runtime.Object {
	return &iamv0.TeamMemberList{}
}

// Destroy implements rest.Storage.
func (s *TeamMembersREST) Destroy() {}

// NamespaceScoped implements rest.Scoper.
func (s *TeamMembersREST) NamespaceScoped() bool {
	return true
}

// ProducesMIMETypes implements rest.StorageMetadata.
func (s *TeamMembersREST) ProducesMIMETypes(verb string) []string {
	return []string{"application/json"}
}

// ProducesObject implements rest.StorageMetadata.
func (s *TeamMembersREST) ProducesObject(verb string) interface{} {
	return s.New()
}

// Connect implements rest.Connecter.
func (s *TeamMembersREST) Connect(ctx context.Context, name string, options runtime.Object, responder rest.Responder) (http.Handler, error) {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		//nolint:staticcheck // not migrated to OpenFeature
		if !s.features.IsEnabledGlobally(featuremgmt.FlagKubernetesTeamBindings) {
			responder.Error(apierrors.NewForbidden(iamv0alpha1.TeamResourceInfo.GroupResource(),
				name, errors.New("functionality not available")))
			return
		}

		ctx, span := s.tracer.Start(r.Context(), "team.members")
		defer span.End()

		authInfo, ok := types.AuthInfoFrom(ctx)
		if !ok {
			responder.Error(apierrors.NewUnauthorized("no identity found"))
			return
		}

		// https://github.com/grafana/grafana/blob/8649534e37b4c3520af538e311fb3a84c7b9f29f/public/app/features/teams/TeamPages.tsx#L74
		checkTeamAccess, err := s.accessClient.Check(ctx, authInfo, types.CheckRequest{
			Namespace: authInfo.GetNamespace(),
			Group:     iamv0alpha1.TeamResourceInfo.GroupResource().Group,
			Resource:  iamv0alpha1.TeamResourceInfo.GroupResource().Resource,
			Verb:      utils.VerbGetPermissions,
			Name:      name,
		}, "")
		if err != nil || !checkTeamAccess.Allowed {
			responder.Error(apierrors.NewForbidden(iamv0alpha1.TeamResourceInfo.GroupResource(),
				name, errors.New("you'll need additional permissions to perform this action. Permissions needed: \"GetPermissions\" on the \"Team\" resource")))
			return
		}

		queryParams, err := url.ParseQuery(r.URL.RawQuery)
		if err != nil {
			responder.Error(err)
			return
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
					Namespace: authInfo.GetNamespace(),
				},
				Fields: []*resourcepb.Requirement{
					{
						Key:      resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM,
						Operator: string(selection.Equals),
						Values:   []string{name},
					},
				},
			},
			Limit:   int64(limit),
			Offset:  int64(offset),
			Page:    int64(page),
			Explain: queryParams.Has("explain") && queryParams.Get("explain") != "false",
			Fields: []string{
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_SUBJECT,
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_TEAM,
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_PERMISSION,
				resource.SEARCH_FIELD_PREFIX + builders.TEAM_BINDING_EXTERNAL,
			},
		}

		searchResult, err := s.client.Search(ctx, searchRequest)
		if err != nil {
			responder.Error(err)
			return
		}

		parsedResult, err := parseResults(searchResult)
		if err != nil {
			responder.Error(err)
			return
		}

		result := &iamv0alpha1.GetMembersResponse{
			GetMembersBody: parsedResult,
		}

		responder.Object(http.StatusOK, result)
	}), nil
}

// NewConnectOptions implements rest.Connecter.
func (s *TeamMembersREST) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, false, ""
}

// ConnectMethods implements rest.Connecter.
func (s *TeamMembersREST) ConnectMethods() []string {
	return []string{http.MethodGet}
}

func parseResults(result *resourcepb.ResourceSearchResponse) (iamv0alpha1.GetMembersBody, error) {
	if result == nil {
		return iamv0alpha1.GetMembersBody{}, nil
	}
	if result.Error != nil {
		return iamv0alpha1.GetMembersBody{}, fmt.Errorf("%d error searching: %s: %s", result.Error.Code, result.Error.Message, result.Error.Details)
	}
	if result.Results == nil {
		return iamv0alpha1.GetMembersBody{}, nil
	}

	subjectNameIDX := -1
	teamRefIDX := -1
	permissionIDX := -1
	externalIDX := -1

	for i, v := range result.Results.Columns {
		if v == nil {
			continue
		}

		switch v.Name {
		case builders.TEAM_BINDING_SUBJECT:
			subjectNameIDX = i
		case builders.TEAM_BINDING_TEAM:
			teamRefIDX = i
		case builders.TEAM_BINDING_PERMISSION:
			permissionIDX = i
		case builders.TEAM_BINDING_EXTERNAL:
			externalIDX = i
		}
	}

	if subjectNameIDX < 0 {
		return iamv0alpha1.GetMembersBody{}, fmt.Errorf("required column '%s' not found in search results", builders.TEAM_BINDING_SUBJECT)
	}
	if teamRefIDX < 0 {
		return iamv0alpha1.GetMembersBody{}, fmt.Errorf("required column '%s' not found in search results", builders.TEAM_BINDING_TEAM)
	}
	if permissionIDX < 0 {
		return iamv0alpha1.GetMembersBody{}, fmt.Errorf("required column '%s' not found in search results", builders.TEAM_BINDING_PERMISSION)
	}
	if externalIDX < 0 {
		return iamv0alpha1.GetMembersBody{}, fmt.Errorf("required column '%s' not found in search results", builders.TEAM_BINDING_EXTERNAL)
	}

	body := iamv0alpha1.GetMembersBody{
		Items: make([]iamv0alpha1.GetMembersTeamUser, len(result.Results.Rows)),
	}

	for i, row := range result.Results.Rows {
		if len(row.Cells) != len(result.Results.Columns) {
			return iamv0alpha1.GetMembersBody{}, fmt.Errorf("error parsing team binding response: mismatch number of columns and cells")
		}

		body.Items[i] = iamv0alpha1.GetMembersTeamUser{
			User:       string(row.Cells[subjectNameIDX]),
			Team:       string(row.Cells[teamRefIDX]),
			Permission: string(row.Cells[permissionIDX]),
			External:   string(row.Cells[externalIDX]) == "true",
		}
	}

	return body, nil
}
