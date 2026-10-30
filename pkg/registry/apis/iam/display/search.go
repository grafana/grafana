package display

import (
	"context"
	"fmt"
	"strconv"

	"golang.org/x/sync/errgroup"
	"k8s.io/apimachinery/pkg/selection"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/api/dtos"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	iam "github.com/grafana/grafana/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search/builders"
)

// SearchDisplayProvider resolves display info using the unified search index as
// the primary source. Identities not yet indexed (e.g. bootstrap users, items
// only written to legacy storage) are resolved by falling back to the supplied
// LegacyIdentityStore.
type SearchDisplayProvider struct {
	client resourcepb.ResourceIndexClient
}

func NewSearchDisplayProvider(client resourcepb.ResourceIndexClient) *SearchDisplayProvider {
	return &SearchDisplayProvider{client: client}
}

var userSearchDisplayFields = []string{
	resource.SEARCH_FIELD_TITLE,
	builders.USER_EMAIL,
	builders.USER_LOGIN,
	resource.SEARCH_FIELD_LEGACY_ID,
}

var serviceAccountSearchDisplayFields = []string{
	resource.SEARCH_FIELD_TITLE,
	resource.SEARCH_FIELD_LEGACY_ID,
}

func (r *SearchDisplayProvider) GetDisplayList(ctx context.Context, ns authlib.NamespaceInfo, key []string) (*iam.DisplayList, error) {
	keys := parseKeys(key)

	rsp := &iam.DisplayList{
		Keys:        keys.keys,
		InvalidKeys: keys.invalid,
		Items:       make([]iam.Display, 0, len(keys.uids)+len(keys.ids)+len(keys.disp)),
	}

	foundUIDs := make(map[string]struct{}, len(keys.uids))
	foundIDs := make(map[int64]struct{}, len(keys.ids))

	jobs := r.buildSearchJobs(ns, keys)
	if len(jobs) > 0 {
		responses := make([]*resourcepb.ResourceSearchResponse, len(jobs))
		g, gctx := errgroup.WithContext(ctx)
		for i, j := range jobs {
			g.Go(func() error {
				srsp, err := r.client.Search(gctx, j.req)
				if err := resource.StatusErrorFromResponse(srsp.GetError(), err); err != nil {
					return err
				}
				responses[i] = srsp
				return nil
			})
		}
		if err := g.Wait(); err != nil {
			return nil, err
		}
		// Merge serially to keep deterministic ordering (users before
		// service accounts, UID matches before ID matches) and avoid
		// needing locks around the shared maps and slice.
		for i, srsp := range responses {
			if err := appendDisplayRows(rsp, srsp, jobs[i].identityType, foundUIDs, foundIDs); err != nil {
				return nil, err
			}
		}
	}

	if len(keys.disp) > 0 {
		rsp.Items = append(rsp.Items, keys.disp...)
	}
	return rsp, nil
}

type searchJob struct {
	req          *resourcepb.ResourceSearchRequest
	identityType authlib.IdentityType
}

// buildSearchJobs returns the set of search requests needed to resolve display
// info for the given keys. Users and service accounts are separate resources
// in the search index, and each is queried by UID and by deprecated internal
// ID, yielding up to four independent requests.
func (r *SearchDisplayProvider) buildSearchJobs(ns authlib.NamespaceInfo, keys dispKeys) []searchJob {
	if len(keys.uids) == 0 && len(keys.ids) == 0 {
		return nil
	}

	targets := []struct {
		resource     string
		identityType authlib.IdentityType
		fields       []string
	}{
		{"users", authlib.TypeUser, userSearchDisplayFields},
		{"serviceaccounts", authlib.TypeServiceAccount, serviceAccountSearchDisplayFields},
	}

	jobs := make([]searchJob, 0, 2*len(targets))
	for _, target := range targets {
		newReq := func() *resourcepb.ResourceSearchRequest {
			return &resourcepb.ResourceSearchRequest{
				Limit:        100, // although the query should only return one item
				Fields:       target.fields,
				ResultFormat: resourcepb.ResourceSearchRequest_FIELD_VALUES,
				Options: &resourcepb.ListOptions{
					Key: &resourcepb.ResourceKey{
						Namespace: ns.Value,
						Group:     iam.GROUP,
						Resource:  target.resource,
					},
				},
			}
		}

		for _, uid := range keys.uids {
			req := newReq()
			req.Options.Fields = []*resourcepb.Requirement{{
				Key:      resource.SEARCH_FIELD_NAME,
				Operator: string(selection.In),
				Values:   []string{uid},
			}}
			jobs = append(jobs, searchJob{req: req, identityType: target.identityType})
		}

		// Labels do support OR, so lets use that to search for multiple IDs at once
		if len(keys.ids) > 0 {
			idStrs := make([]string, 0, len(keys.ids))
			for _, id := range keys.ids {
				idStrs = append(idStrs, strconv.FormatInt(id, 10))
			}
			req := newReq()
			req.Options.Labels = []*resourcepb.Requirement{{
				Key:      utils.LabelKeyDeprecatedInternalID, // nolint:staticcheck
				Operator: string(selection.In),
				Values:   idStrs,
			}}
			jobs = append(jobs, searchJob{req: req, identityType: target.identityType})
		}
	}
	return jobs
}

type displaySearchRow struct {
	key        *resourcepb.ResourceKey
	title      string
	email      string
	login      string
	internalID int64
}

func appendDisplayRows(list *iam.DisplayList, rsp *resourcepb.ResourceSearchResponse, identityType authlib.IdentityType, foundUIDs map[string]struct{}, foundIDs map[int64]struct{}) error {
	rows, err := decodeDisplayRows(rsp)
	if err != nil {
		return err
	}

	for _, row := range rows {
		displayName := row.title
		if displayName == "" {
			displayName = row.login
		}
		if displayName == "" {
			displayName = row.email
		}

		foundUIDs[row.key.Name] = struct{}{}
		if row.internalID != 0 {
			foundIDs[row.internalID] = struct{}{}
		}

		list.Items = append(list.Items, iam.Display{
			Identity: iam.IdentityRef{
				Type: identityType,
				Name: row.key.Name,
			},
			DisplayName: displayName,
			InternalID:  row.internalID,
			AvatarURL:   dtos.GetGravatarUrlWithDefault(fakeCfgForGravatar, row.email, displayName),
		})
	}
	return nil
}

func decodeDisplayRows(rsp *resourcepb.ResourceSearchResponse) ([]displaySearchRow, error) {
	if rsp == nil {
		return nil, nil
	}

	if rsp.GetResultFormat() != resourcepb.ResourceSearchRequest_FIELD_VALUES {
		return nil, fmt.Errorf("unsupported search result format %d", rsp.GetResultFormat())
	}
	rows := make([]displaySearchRow, 0, len(rsp.Rows))
	for i, row := range rsp.Rows {
		if row == nil || row.Key == nil {
			continue
		}
		values, err := resource.DecodeSearchValues(rsp.Fields, row)
		if err != nil {
			return nil, fmt.Errorf("decode display search row %d: %w", i, err)
		}
		title, _ := values[resource.SEARCH_FIELD_TITLE].(string)
		email, _ := values[builders.USER_EMAIL].(string)
		login, _ := values[builders.USER_LOGIN].(string)
		internalID, _ := values[resource.SEARCH_FIELD_LEGACY_ID].(int64)
		rows = append(rows, displaySearchRow{
			key:        row.Key,
			title:      title,
			email:      email,
			login:      login,
			internalID: internalID,
		})
	}
	return rows, nil
}
