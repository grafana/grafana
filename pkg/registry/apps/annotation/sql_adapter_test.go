package annotation

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/annotations/annotationsimpl"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/search/model"
	"github.com/grafana/grafana/pkg/services/tag/tagimpl"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/tests/testsuite"
)

func TestMain(m *testing.M) {
	testsuite.Run(m)
}

// fakeRepo implements annotations.Repository for testing.
type fakeRepo struct {
	items []*annotations.ItemDTO
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{
		items: []*annotations.ItemDTO{},
	}
}

func (f *fakeRepo) addItem(item *annotations.ItemDTO) {
	f.items = append(f.items, item)
}

func (f *fakeRepo) Find(ctx context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	start := int(query.Offset)
	end := start + int(query.Limit)

	if start >= len(f.items) {
		return []*annotations.ItemDTO{}, nil
	}

	if end > len(f.items) {
		end = len(f.items)
	}

	return f.items[start:end], nil
}

func (f *fakeRepo) Save(ctx context.Context, item *annotations.Item) error {
	return nil
}

func (f *fakeRepo) SaveMany(ctx context.Context, items []annotations.Item) error {
	return nil
}

func (f *fakeRepo) Update(ctx context.Context, item *annotations.Item) error {
	return nil
}

func (f *fakeRepo) Get(ctx context.Context, query *annotations.ItemQuery) (*annotations.ItemDTO, error) {
	return nil, nil
}

func (f *fakeRepo) Delete(ctx context.Context, params *annotations.DeleteParams) error {
	return nil
}

func (f *fakeRepo) FindTags(ctx context.Context, query *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, nil
}

func TestSQLAdapter_ListPagination(t *testing.T) {
	cfg := &setting.Cfg{}
	nsMapper := request.GetNamespaceMapper(cfg)

	// create 5 test annotations
	repo := newFakeRepo()
	for i := 0; i < 5; i++ {
		repo.addItem(&annotations.ItemDTO{
			ID:   int64(i + 1),
			Text: fmt.Sprintf("annotation %d", i+1),
		})
	}

	adapter := NewSQLAdapter(repo, nil, nsMapper, cfg)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
	})
	namespace := "default"

	tests := []struct {
		desc                string
		limit               int64
		expectedCount       int
		expectedHasContinue bool
		expectedFirstID     string
		expectedLastID      string
	}{
		{
			desc:                "should have continuation token when limit < total items",
			limit:               3,
			expectedCount:       3,
			expectedHasContinue: true,
			expectedFirstID:     "a-1",
			expectedLastID:      "a-3",
		},
		{
			desc:                "should not have continuation token whe limit == total items",
			limit:               5,
			expectedCount:       5,
			expectedHasContinue: false,
			expectedFirstID:     "a-1",
			expectedLastID:      "a-5",
		},
		{
			desc:                "should not have continuation token: limit > total items",
			limit:               10,
			expectedCount:       5,
			expectedHasContinue: false,
			expectedFirstID:     "a-1",
			expectedLastID:      "a-5",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			opts := ListOptions{
				Limit: tt.limit,
			}

			result, err := adapter.List(ctx, namespace, opts)
			require.NoError(t, err)

			assert.Len(t, result.Items, tt.expectedCount)

			if tt.expectedHasContinue {
				assert.NotEmpty(t, result.Continue, "continue token should not be empty")
			} else {
				assert.Empty(t, result.Continue, "continuation token is not expected")
			}

			if tt.expectedCount > 0 {
				assert.Equal(t, tt.expectedFirstID, result.Items[0].Name)
				assert.Equal(t, tt.expectedLastID, result.Items[tt.expectedCount-1].Name)
			}
		})
	}

	t.Run("Should paginate through all items using continuation token", func(t *testing.T) {
		// First request
		opts := ListOptions{Limit: 2}
		result1, err := adapter.List(ctx, namespace, opts)
		require.NoError(t, err)
		assert.Len(t, result1.Items, 2)
		assert.NotEmpty(t, result1.Continue)
		assert.Equal(t, "a-1", result1.Items[0].Name)
		assert.Equal(t, "a-2", result1.Items[1].Name)

		// Second request with continuation token
		opts2 := ListOptions{Limit: 2, Continue: result1.Continue}
		result2, err := adapter.List(ctx, namespace, opts2)
		require.NoError(t, err)
		assert.Len(t, result2.Items, 2)
		assert.NotEmpty(t, result2.Continue)
		assert.Equal(t, "a-3", result2.Items[0].Name)
		assert.Equal(t, "a-4", result2.Items[1].Name)

		// Third request to get last item
		opts3 := ListOptions{Limit: 2, Continue: result2.Continue}
		result3, err := adapter.List(ctx, namespace, opts3)
		require.NoError(t, err)
		assert.Len(t, result3.Items, 1)
		assert.Empty(t, result3.Continue, "Expected no continuation token on last page")
		assert.Equal(t, "a-5", result3.Items[0].Name)
	})
}

func TestSQLAdapter_ListWithCreatedByFilter(t *testing.T) {
	sqlDB := db.InitTestDB(t)
	cfg := setting.NewCfg()
	cfg.AnnotationMaximumTagsLength = 2

	dashSvc := &dashboards.FakeDashboardService{}
	dashSvc.On("SearchDashboards", mock.Anything, mock.Anything).Return(model.HitList{}, nil)

	repo := annotationsimpl.ProvideService(
		sqlDB, cfg,
		featuremgmt.WithFeatures(),
		tagimpl.ProvideService(sqlDB),
		tracing.InitializeTracerForTest(),
		nil,
		dashSvc,
		nil,
	)
	adapter := NewSQLAdapter(repo, nil, request.GetNamespaceMapper(cfg), cfg)

	ctx := identity.WithRequester(context.Background(), &identity.StaticRequester{
		OrgID: 1,
		Permissions: map[int64]map[string][]string{
			1: {accesscontrol.ActionAnnotationsRead: []string{accesscontrol.ScopeAnnotationsAll}},
		},
	})

	// Insert a user with a known UID into the DB
	const targetUID = "test-user-uid-abc"
	var targetUserID int64
	err := sqlDB.WithDbSession(context.Background(), func(sess *db.Session) error {
		now := time.Now()
		u := &user.User{
			UID:     targetUID,
			OrgID:   1,
			Login:   "test-user-abc",
			Email:   "test-user-abc@example.com",
			Created: now,
			Updated: now,
		}
		_, err := sess.Insert(u)
		targetUserID = u.ID
		return err
	})
	require.NoError(t, err)

	// Annotation created by the target user
	ann1 := &annotations.Item{OrgID: 1, UserID: targetUserID, Text: "by target user", Epoch: 100}
	require.NoError(t, repo.Save(context.Background(), ann1))

	// Annotation created by a different user
	ann2 := &annotations.Item{OrgID: 1, UserID: 99999, Text: "by other user", Epoch: 200}
	require.NoError(t, repo.Save(context.Background(), ann2))

	t.Run("returns only annotations by the given user UID", func(t *testing.T) {
		result, err := adapter.List(ctx, "default", ListOptions{
			Limit:     2,
			CreatedBy: targetUID,
		})
		require.NoError(t, err)
		require.Len(t, result.Items, 1)
		assert.Equal(t, "by target user", result.Items[0].Spec.Text)
	})

	t.Run("returns nothing for a non-existent user UID", func(t *testing.T) {
		result, err := adapter.List(ctx, "default", ListOptions{
			Limit:     2,
			CreatedBy: "nonexistent-uid",
		})
		require.NoError(t, err)
		assert.Empty(t, result.Items)
	})

	t.Run("returns all annotations when CreatedBy is not set", func(t *testing.T) {
		result, err := adapter.List(ctx, "default", ListOptions{
			Limit: 2,
		})
		require.NoError(t, err)
		assert.Len(t, result.Items, 2)
	})
}
