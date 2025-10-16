package search_test

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
	"github.com/grafana/grafana/pkg/storage/unified/search"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/selection"
)

// func TestUserDocumentBuilder(t *testing.T) {
// 	info, err := search.GetUserBuilder()
// 	require.NoError(t, err)
// 	require.NotNil(t, info.Builder)

// 	builder := info.Builder

// 	base := filepath.Join("testdata", "doc")
// 	inPath := filepath.Join(base, "user-example.json")
// 	outPath := filepath.Join(base, "user-example-out.json")

// 	// nolint:gosec
// 	raw, err := os.ReadFile(inPath)
// 	if err != nil {
// 		t.Fatalf("missing input fixture %s: %v", inPath, err)
// 	}

// 	gr := iamv0.UserResourceInfo.GroupResource()
// 	key := &resourcepb.ResourceKey{
// 		Namespace: "default",
// 		Group:     gr.Group,
// 		Resource:  gr.Resource,
// 		Name:      "example", // set by input file metadata.name
// 	}

// 	doc, err := builder.BuildDocument(context.Background(), key, 1234, raw)
// 	require.NoError(t, err)
// 	require.NotNil(t, doc)

// 	// Core
// 	require.Equal(t, key.Name, doc.Name)
// 	require.Equal(t, int64(1234), doc.RV)
// 	require.Equal(t, key, doc.Key)
// 	require.Equal(t, key.Name, doc.Title)

// 	// Custom field assertions (email/login added to Fields)
// 	if assert.NotNil(t, doc.Fields) {
// 		assert.Equal(t, "example@example.com", doc.Fields[search.USER_EMAIL])
// 		assert.Equal(t, "example", doc.Fields[search.USER_LOGIN])
// 	}

// 	// Snapshot compare
// 	out, err := json.MarshalIndent(doc, "", "  ")
// 	require.NoError(t, err)

// 	// nolint:gosec
// 	expected, readErr := os.ReadFile(outPath)
// 	if readErr != nil {
// 		err2 := os.MkdirAll(filepath.Dir(outPath), 0o755)
// 		require.NoError(t, err2)
// 		err2 = os.WriteFile(outPath, out, 0o600)
// 		require.NoError(t, err2)
// 		t.Fatalf("snapshot created at %s; re-run tests", outPath)
// 	}
// 	assert.JSONEq(t, string(expected), string(out))
// }

func TestUserSearch(t *testing.T) {
	key := resource.NamespacedResource{
		Namespace: "default",
		Group:     iamv0.UserResourceInfo.GroupResource().Group,
		Resource:  iamv0.UserResourceInfo.GroupResource().Resource,
	}

	index := newTestUsersIndex(t, 100, 2, func(index resource.ResourceIndex) (int64, error) {
		return 0, nil
	})
	users := []iamv0.User{
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "user1",
				Namespace: "default",
			},
			Spec: iamv0.UserSpec{
				Login: "user.one",
				Email: "user.one@test.com",
				Role:  "Viewer",
			},
		},
		{
			ObjectMeta: metav1.ObjectMeta{
				Name:      "user2",
				Namespace: "default",
			},
			Spec: iamv0.UserSpec{
				Login: "user.two",
				Email: "user.two@test.com",
				Role:  "Viewer",
			},
		},
	}
	indexUserDocuments(t, index, key, users)

	// Sanity check - title search
	checkUserSearchQuery(t, index, newTestsUserQueryWithTitle(key, "user2"), []string{"user2"})

	t.Run("can search users by login", func(t *testing.T) {
		// Search by login
		checkUserSearchQuery(t, index, newTestUserQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.login",
				Operator: string(selection.Equals),
				Values:   []string{"user.one"},
			},
		}), []string{"user1"})
		checkUserSearchQuery(t, index, newTestUserQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.login",
				Operator: string(selection.Equals),
				Values:   []string{"user.two"},
			},
		}), []string{"user2"})
	})

	t.Run("can search users by wildcard login", func(t *testing.T) {
		checkUserSearchQuery(t, index, newTestUserQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.login",
				Operator: string(selection.Equals),
				Values:   []string{"user.*"},
			},
		}), []string{"user1", "user2"})
	})

	t.Run("can search users by email", func(t *testing.T) {
		// Search by email
		checkUserSearchQuery(t, index, newTestUserQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.email",
				Operator: string(selection.Equals),
				Values:   []string{"user.one@test.com"},
			},
		}), []string{"user1"})

		checkUserSearchQuery(t, index, newTestUserQueryWithReqs(key, []*resourcepb.Requirement{
			{
				Key:      "fields.email",
				Operator: string(selection.Equals),
				Values:   []string{"user.two@test.com"},
			},
		}), []string{"user2"})
	})
}

func newTestUsersIndex(t testing.TB, threshold int64, size int64, writer resource.BuildFn) resource.ResourceIndex {
	t.Helper()
	gr := iamv0.UserResourceInfo.GroupResource()
	key := &resourcepb.ResourceKey{
		Namespace: "default",
		Group:     gr.Group,
		Resource:  gr.Resource,
	}
	backend, err := search.NewBleveBackend(search.BleveOptions{
		Root:          t.TempDir(),
		FileThreshold: threshold, // use in-memory for tests
	}, tracing.NewNoopTracerService(), nil)
	require.NoError(t, err)

	t.Cleanup(backend.Stop)

	ctx := identity.WithRequester(context.Background(), &user.SignedInUser{Namespace: "ns"})

	info, err := search.GetUserBuilder()
	require.NoError(t, err)

	index, err := backend.BuildIndex(ctx, resource.NamespacedResource{
		Namespace: key.Namespace,
		Group:     key.Group,
		Resource:  key.Resource,
	}, size, info.Fields, "test", writer, nil, false)
	require.NoError(t, err)

	return index
}

func indexUserDocuments(t *testing.T, index resource.ResourceIndex, key resource.NamespacedResource, users []iamv0.User) {
	t.Helper()
	items := make([]*resource.BulkIndexItem, 0, len(users))
	for _, user := range users {
		items = append(items, &resource.BulkIndexItem{
			Action: resource.ActionIndex,
			Doc: &resource.IndexableDocument{
				RV:   1,
				Name: user.ObjectMeta.Name,
				Key: &resourcepb.ResourceKey{
					Name:      user.Name,
					Namespace: key.Namespace,
					Group:     key.Group,
					Resource:  key.Resource,
				},
				Title:  user.Name,
				Fields: map[string]any{search.USER_LOGIN: user.Spec.Login, search.USER_EMAIL: user.Spec.Email},
			},
		})
	}
	req := &resource.BulkIndexRequest{Items: items}
	require.NoError(t, index.BulkIndex(req))
}

func checkUserSearchQuery(t *testing.T, index resource.ResourceIndex, query *resourcepb.ResourceSearchRequest, orderedExpectedNames []string) {
	t.Helper()
	res, err := index.Search(context.Background(), nil, query, nil)
	require.NoError(t, err)
	require.Equal(t, int64(len(orderedExpectedNames)), res.TotalHits)
	names := make([]string, len(res.Results.Rows))
	for ix, row := range res.Results.Rows {
		names[ix] = row.Key.Name
	}
	assert.ElementsMatch(t, orderedExpectedNames, names)
}

func newTestUserQueryWithReqs(key resource.NamespacedResource, filterReqs []*resourcepb.Requirement) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
			Fields: filterReqs,
		},
		Limit: 100,
	}
}

func newTestsUserQueryWithTitle(key resource.NamespacedResource, title string) *resourcepb.ResourceSearchRequest {
	return &resourcepb.ResourceSearchRequest{
		Options: &resourcepb.ListOptions{
			Key: &resourcepb.ResourceKey{
				Namespace: key.Namespace,
				Group:     key.Group,
				Resource:  key.Resource,
			},
		},
		Query: title,
		Limit: 100,
	}
}
