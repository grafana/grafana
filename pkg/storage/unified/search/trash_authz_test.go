package search_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	authzextv1 "github.com/grafana/grafana/pkg/services/authz/proto/v1"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Trash authorizes on folder admin or deleter, not the read check. These tests exist
// because reusing the read check would disclose other people's deleted objects to
// anyone with read access to the folder, which for dashboards is most users.

const (
	trashAlice = "user:alice" // deleted things
	trashBob   = "user:bob"   // can read the folder, is not an admin
	trashCarol = "user:carol" // folder admin
)

// trashAccessClient answers the folder-admin and read checks separately. A stub that
// ignored the verb could not tell the two rules apart, and so could not catch the
// disclosure these tests guard against.
type trashAccessClient struct {
	adminFolders map[string]bool
	readAll      bool

	// Every folder checked, in order, including repeats, so tests can assert on the
	// cache.
	adminCheckFolders []string
	// Counted so a test can show which rule ran.
	readChecks int
}

func (c *trashAccessClient) Check(_ context.Context, _ authlib.AuthInfo, req authlib.CheckRequest, folder string) (authlib.CheckResponse, error) {
	if req.Verb == utils.VerbSetPermissions {
		c.adminCheckFolders = append(c.adminCheckFolders, folder)
		return authlib.CheckResponse{Allowed: c.adminFolders[folder], Zookie: authlib.NoopZookie{}}, nil
	}
	c.readChecks++
	return authlib.CheckResponse{Allowed: c.readAll, Zookie: authlib.NoopZookie{}}, nil
}

func (c *trashAccessClient) Compile(_ context.Context, _ authlib.AuthInfo, _ authlib.ListRequest) (authlib.ItemChecker, authlib.Zookie, error) {
	return func(_, _ string) bool {
		c.readChecks++
		return c.readAll
	}, authlib.NoopZookie{}, nil
}

func (c *trashAccessClient) BatchCheck(_ context.Context, _ authlib.AuthInfo, req authlib.BatchCheckRequest) (authlib.BatchCheckResponse, error) {
	results := make(map[string]authlib.BatchCheckResult, len(req.Checks))
	for _, item := range req.Checks {
		c.readChecks++
		results[item.CorrelationID] = authlib.BatchCheckResult{Allowed: c.readAll}
	}
	return authlib.BatchCheckResponse{Results: results}, nil
}

func (c *trashAccessClient) Read(context.Context, *authzextv1.ReadRequest) (*authzextv1.ReadResponse, error) {
	return nil, nil
}

func (c *trashAccessClient) Write(context.Context, *authzextv1.WriteRequest) error { return nil }

// adminCheckCount is how many set_permissions calls were made.
func (c *trashAccessClient) adminCheckCount() int { return len(c.adminCheckFolders) }

func trashDoc(name, folder, deletedBy string) *resource.BulkIndexItem {
	return &resource.BulkIndexItem{
		Action: resource.ActionIndex,
		Doc: &resource.IndexableDocument{
			RV:    1,
			Name:  name,
			Title: name,
			Key: &resourcepb.ResourceKey{
				Name:      name,
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
			Folder:    folder,
			IsDeleted: new(true),
			DeletedBy: &deletedBy,
		},
	}
}

func liveDoc(name, folder string) *resource.BulkIndexItem {
	d := trashDoc(name, folder, "")
	d.Doc.IsDeleted = nil
	d.Doc.DeletedBy = nil
	return d
}

// trashIndexBuilders covers both authorization paths. Post-rank is intended to
// become the default, so trash authz on only the in-searcher path would silently
// revert to the read check when that happens.
func trashIndexBuilders() []struct {
	name  string
	build func(t *testing.T) resource.ResourceIndex
} {
	return []struct {
		name  string
		build func(t *testing.T) resource.ResourceIndex
	}{
		{"in-searcher", func(t *testing.T) resource.ResourceIndex {
			return newTestDashboardsIndex(t, threshold, 20, func(resource.ResourceIndex) (int64, error) { return 1, nil })
		}},
		{"post-rank", func(t *testing.T) resource.ResourceIndex {
			return newTestDashboardsIndexPostRank(t, 20)
		}},
	}
}

func trashQueryFor(mutate func(*resourcepb.ResourceSearchRequest)) *resourcepb.ResourceSearchRequest {
	q := &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: "default",
				Group:     "dashboard.grafana.app",
				Resource:  "dashboards",
			},
		},
		Limit:     100,
		IsDeleted: true,
	}
	if mutate != nil {
		mutate(q)
	}
	return q
}

// runTrashSearch runs a search as the given user. uid is bare, so "alice" becomes the
// "user:alice" that GetUID reports and deleted_by holds.
func runTrashSearch(
	t *testing.T,
	index resource.ResourceIndex,
	ac authlib.AccessClient,
	uid string,
	q *resourcepb.ResourceSearchRequest,
) *resourcepb.ResourceSearchResponse {
	t.Helper()
	user := &identity.StaticRequester{Type: authlib.TypeUser, UserUID: uid, Namespace: "default"}
	ctx := authlib.WithAuthInfo(context.Background(), user)
	res, err := index.Search(ctx, ac, q, nil, nil)
	require.NoError(t, err)
	require.Nil(t, res.Error)
	return res
}

func namesOf(res *resourcepb.ResourceSearchResponse) []string {
	rows := res.Results.GetRows()
	out := make([]string, 0, len(rows))
	for _, row := range rows {
		out = append(out, row.Key.Name)
	}
	return out
}

// Bob can read the folder, so the live-search check would let him see this, but he
// neither administers the folder nor deleted the object.
func TestTrashAuthz_ReaderCannotSeeAnotherUsersDeletion(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			indexDocs(t, index, []*resource.BulkIndexItem{
				trashDoc("alices-dash", "folder-1", trashAlice),
			})

			// Read access everywhere, admin nowhere.
			ac := &trashAccessClient{readAll: true}
			res := runTrashSearch(t, index, ac, "bob", trashQueryFor(nil))

			assert.Empty(t, namesOf(res), "a folder reader must not see another user's deleted object")
			assert.Equal(t, int64(0), res.TotalHits)
		})
	}
}

func TestTrashAuthz_FolderAdminSeesOtherUsersDeletions(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			indexDocs(t, index, []*resource.BulkIndexItem{
				trashDoc("alices-dash", "folder-1", trashAlice),
				trashDoc("elsewhere", "folder-2", trashAlice),
			})

			// Admin of folder-1 only, with no read access, so only the admin rule can
			// grant this.
			ac := &trashAccessClient{adminFolders: map[string]bool{"folder-1": true}}
			res := runTrashSearch(t, index, ac, "carol", trashQueryFor(nil))

			assert.Equal(t, []string{"alices-dash"}, namesOf(res))
		})
	}
}

func TestTrashAuthz_DeleterSeesTheirOwnDeletionWithoutBeingAdmin(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			indexDocs(t, index, []*resource.BulkIndexItem{
				trashDoc("alices-dash", "folder-1", trashAlice),
				trashDoc("bobs-dash", "folder-1", trashBob),
			})

			// Neither admin nor reader anywhere.
			ac := &trashAccessClient{}
			res := runTrashSearch(t, index, ac, "alice", trashQueryFor(nil))

			assert.Equal(t, []string{"alices-dash"}, namesOf(res))

			// The deleter half comes from the indexed field, so it costs no authz
			// call at all. That is why deleted_by was indexed.
			assert.Zero(t, ac.readChecks, "the read check must not be consulted for trash")
		})
	}
}

// A provisioned object is restored from its repository, never from trash.
func TestTrashAuthz_ProvisionedObjectIsNeverVisible(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			provisioned := trashDoc("provisioned-dash", "folder-1", trashAlice)
			provisioned.Doc.IsProvisioned = new(true)
			indexDocs(t, index, []*resource.BulkIndexItem{provisioned})

			for _, who := range []struct {
				name string
				uid  string
				ac   *trashAccessClient
			}{
				{"deleter", "alice", &trashAccessClient{}},
				{"folder admin", "carol", &trashAccessClient{adminFolders: map[string]bool{"folder-1": true}}},
				{"reader", "bob", &trashAccessClient{readAll: true}},
			} {
				t.Run(who.name, func(t *testing.T) {
					res := runTrashSearch(t, index, who.ac, who.uid, trashQueryFor(nil))
					assert.Empty(t, namesOf(res))
				})
			}
		})
	}
}

// The check is a network call, so a page of 50 results across 50 folders would
// otherwise cost 50 of them.
func TestTrashAuthz_FolderAdminCheckIsCachedPerFolder(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			folders := []string{"folder-1", "folder-2"}
			names := []string{"a", "b", "c", "d"}
			docs := make([]*resource.BulkIndexItem, 0, len(folders)*len(names))
			for _, folder := range folders {
				for _, name := range names {
					docs = append(docs, trashDoc(folder+"-"+name, folder, trashAlice))
				}
			}
			indexDocs(t, index, docs)

			ac := &trashAccessClient{adminFolders: map[string]bool{"folder-1": true, "folder-2": true}}
			res := runTrashSearch(t, index, ac, "carol", trashQueryFor(nil))

			require.Len(t, namesOf(res), 8)
			assert.Equal(t, 2, ac.adminCheckCount(),
				"one check per folder, not per item; got checks for %v", ac.adminCheckFolders)
		})
	}
}

// Live search must be untouched: the read check still decides.
func TestTrashAuthz_LiveSearchIsUnchanged(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			indexDocs(t, index, []*resource.BulkIndexItem{
				liveDoc("live-dash", "folder-1"),
				trashDoc("deleted-dash", "folder-1", trashAlice),
			})

			t.Run("reader sees live results", func(t *testing.T) {
				ac := &trashAccessClient{readAll: true}
				q := trashQueryFor(nil)
				q.IsDeleted = false

				res := runTrashSearch(t, index, ac, "bob", q)

				assert.Equal(t, []string{"live-dash"}, namesOf(res))
				assert.Zero(t, ac.adminCheckCount(), "live search must not ask about folder admin")
				assert.Positive(t, ac.readChecks, "live search must use the read check")
			})

			t.Run("read denied means no results", func(t *testing.T) {
				ac := &trashAccessClient{readAll: false, adminFolders: map[string]bool{"folder-1": true}}
				q := trashQueryFor(nil)
				q.IsDeleted = false

				res := runTrashSearch(t, index, ac, "carol", q)

				assert.Empty(t, namesOf(res), "being a folder admin must not grant live read")
			})
		})
	}
}

// Falling back to the read check would be more permissive, so the request is refused.
func TestTrashAuthz_RefusesWhenThereIsNoUser(t *testing.T) {
	index := newTestDashboardsIndex(t, threshold, 20, func(resource.ResourceIndex) (int64, error) { return 1, nil })
	indexDocs(t, index, []*resource.BulkIndexItem{trashDoc("alices-dash", "folder-1", trashAlice)})

	res, err := index.Search(context.Background(), &trashAccessClient{readAll: true}, trashQueryFor(nil), nil, nil)
	require.NoError(t, err)
	require.NotNil(t, res.Error)
	assert.Equal(t, int32(401), res.Error.Code)
}

// The post-rank path narrows the bleve field list for count-only requests and for the
// facet scan. Dropping deleted_by there raises no error: the deleter simply stops
// seeing their own objects.
func TestTrashAuthz_PostRankNarrowedFieldListsKeepDeletedBy(t *testing.T) {
	withTags := func(item *resource.BulkIndexItem, tags ...string) *resource.BulkIndexItem {
		item.Doc.Tags = tags
		return item
	}
	build := func(t *testing.T) resource.ResourceIndex {
		index := newTestDashboardsIndexPostRank(t, 20)
		indexDocs(t, index, []*resource.BulkIndexItem{
			withTags(trashDoc("alices-1", "folder-1", trashAlice), "shared"),
			withTags(trashDoc("alices-2", "folder-1", trashAlice), "shared"),
			withTags(trashDoc("bobs-1", "folder-1", trashBob), "shared"),
		})
		return index
	}

	t.Run("count-only request counts the deleter's own objects", func(t *testing.T) {
		index := build(t)
		q := trashQueryFor(func(q *resourcepb.ResourceSearchRequest) { q.Limit = 0 })

		res := runTrashSearch(t, index, &trashAccessClient{}, "alice", q)

		assert.Equal(t, int64(2), res.TotalHits)
		assert.Empty(t, namesOf(res), "a count-only request returns no rows")
	})

	// A TrashQuery cannot request facets, so this is unreachable through /trash today.
	// Covered because facetScanFields is shared, and a regression would surface only
	// once trash gained facets.
	t.Run("facet counts cover the deleter's own objects", func(t *testing.T) {
		index := build(t)
		q := trashQueryFor(func(q *resourcepb.ResourceSearchRequest) {
			q.Facet = map[string]*resourcepb.ResourceSearchRequest_Facet{
				"tags": {Field: resource.SEARCH_FIELD_TAGS, Limit: 10},
			}
		})

		res := runTrashSearch(t, index, &trashAccessClient{}, "alice", q)

		require.Contains(t, res.Facet, "tags")
		terms := res.Facet["tags"].Terms
		require.Len(t, terms, 1)
		assert.Equal(t, "shared", terms[0].Term)
		assert.Equal(t, int64(2), terms[0].Count, "only Alice's two deletions are hers to see")
	})
}

// The rule has to apply on every window, not just the first.
func TestTrashAuthz_AppliesOnEveryPage(t *testing.T) {
	for _, path := range trashIndexBuilders() {
		t.Run(path.name, func(t *testing.T) {
			index := path.build(t)
			const pairs = 10
			docs := make([]*resource.BulkIndexItem, 0, pairs*2)
			for i := range pairs {
				suffix := string(rune('a' + i))
				docs = append(docs, trashDoc(suffix+"-alice", "folder-1", trashAlice))
				docs = append(docs, trashDoc(suffix+"-bob", "folder-1", trashBob))
			}
			indexDocs(t, index, docs)

			var seen []string
			var after []string
			for page := 0; page < 20; page++ {
				q := trashQueryFor(func(q *resourcepb.ResourceSearchRequest) {
					q.Limit = 3
					q.SearchAfter = after
				})
				res := runTrashSearch(t, index, &trashAccessClient{}, "alice", q)
				rows := res.Results.GetRows()
				if len(rows) == 0 {
					break
				}
				seen = append(seen, namesOf(res)...)
				after = rows[len(rows)-1].SortFields
				require.NotEmpty(t, after)
				if len(rows) < 3 {
					break
				}
			}

			require.Len(t, seen, 10, "every page must be filtered, and Alice owns 10 of the 20")
			for _, name := range seen {
				assert.Contains(t, name, "-alice", "Bob's deletions must never appear")
			}
		})
	}
}
