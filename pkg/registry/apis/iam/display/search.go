package display

import (
	"context"
	"encoding/binary"
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

var searchDisplayFields = []string{
	resource.SEARCH_FIELD_TITLE,
	resource.SEARCH_FIELD_PREFIX + builders.USER_EMAIL,
	resource.SEARCH_FIELD_PREFIX + builders.USER_LOGIN,
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
				if err != nil {
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
			appendDisplayRows(rsp, srsp, jobs[i].identityType, foundUIDs, foundIDs)
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
	}{
		{"users", authlib.TypeUser},
		{"serviceaccounts", authlib.TypeServiceAccount},
	}

	jobs := make([]searchJob, 0, 2*len(targets))
	for _, target := range targets {
		newReq := func() *resourcepb.ResourceSearchRequest {
			return &resourcepb.ResourceSearchRequest{
				Limit:  100, // although the query should only return one item
				Fields: searchDisplayFields,
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

func appendDisplayRows(list *iam.DisplayList, rsp *resourcepb.ResourceSearchResponse, identityType authlib.IdentityType, foundUIDs map[string]struct{}, foundIDs map[int64]struct{}) {
	if rsp == nil || rsp.Results == nil {
		return
	}

	titleIDX, emailIDX, loginIDX, legacyIDIDX := -1, -1, -1, -1
	for i, c := range rsp.Results.Columns {
		switch c.Name {
		case resource.SEARCH_FIELD_TITLE:
			titleIDX = i
		case builders.USER_EMAIL:
			emailIDX = i
		case builders.USER_LOGIN:
			loginIDX = i
		case resource.SEARCH_FIELD_LEGACY_ID:
			legacyIDIDX = i
		}
	}

	for _, row := range rsp.Results.Rows {
		if row == nil || row.Key == nil {
			continue
		}
		var title, email, login string
		var internalID int64
		if cell, ok := cellAt(row.Cells, titleIDX); ok {
			title = string(cell)
		}
		if cell, ok := cellAt(row.Cells, emailIDX); ok {
			email = string(cell)
		}
		if cell, ok := cellAt(row.Cells, loginIDX); ok {
			login = string(cell)
		}
		if cell, ok := cellAt(row.Cells, legacyIDIDX); ok && len(cell) == 8 {
			internalID = int64(binary.BigEndian.Uint64(cell))
		}

		displayName := title
		if displayName == "" {
			displayName = login
		}
		if displayName == "" {
			displayName = email
		}

		foundUIDs[row.Key.Name] = struct{}{}
		if internalID != 0 {
			foundIDs[internalID] = struct{}{}
		}

		list.Items = append(list.Items, iam.Display{
			Identity: iam.IdentityRef{
				Type: identityType,
				Name: row.Key.Name,
			},
			DisplayName: displayName,
			InternalID:  internalID,
			AvatarURL:   dtos.GetGravatarUrlWithDefault(fakeCfgForGravatar, email, displayName),
		})
	}
}

func cellAt(cells [][]byte, idx int) ([]byte, bool) {
	if idx < 0 || idx >= len(cells) || cells[idx] == nil {
		return nil, false
	}
	return cells[idx], true
}
