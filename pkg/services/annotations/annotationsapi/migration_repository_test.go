package annotationsapi

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/annotations"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/services/user/usertest"
	"github.com/grafana/grafana/pkg/setting"
)

type fakeLegacy struct {
	findResult   []*annotations.ItemDTO
	findErr      error
	findCalls    []*annotations.ItemQuery
	updateItems  []*annotations.Item
	deleteParams []*annotations.DeleteParams
}

func (f *fakeLegacy) Find(_ context.Context, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	f.findCalls = append(f.findCalls, query)
	return f.findResult, f.findErr
}
func (f *fakeLegacy) Save(context.Context, *annotations.Item) error      { return nil }
func (f *fakeLegacy) SaveMany(context.Context, []annotations.Item) error { return nil }
func (f *fakeLegacy) Update(_ context.Context, item *annotations.Item) error {
	f.updateItems = append(f.updateItems, item)
	return nil
}
func (f *fakeLegacy) Delete(_ context.Context, params *annotations.DeleteParams) error {
	f.deleteParams = append(f.deleteParams, params)
	return nil
}
func (f *fakeLegacy) FindTags(context.Context, *annotations.TagsQuery) (annotations.FindTagsResult, error) {
	return annotations.FindTagsResult{}, nil
}

type fakeProxy struct {
	listResult []*annotations.ItemDTO
	listErr    error
	listCalls  []*annotations.ItemQuery

	getResult *annotations.ItemDTO
	getErr    error
	getCalls  int

	createID    int64
	createErr   error
	createItems []*annotations.Item

	updateErr   error
	updateCalls int

	deleteErr   error
	deleteCalls int
}

func (f *fakeProxy) List(_ context.Context, _ int64, query *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	f.listCalls = append(f.listCalls, query)
	return f.listResult, f.listErr
}
func (f *fakeProxy) Get(_ context.Context, _ int64, _ int64) (*annotations.ItemDTO, error) {
	f.getCalls++
	return f.getResult, f.getErr
}
func (f *fakeProxy) Create(_ context.Context, _ int64, item *annotations.Item) (int64, error) {
	f.createItems = append(f.createItems, item)
	return f.createID, f.createErr
}
func (f *fakeProxy) Update(context.Context, int64, int64, *annotations.Item) error {
	f.updateCalls++
	return f.updateErr
}
func (f *fakeProxy) Delete(context.Context, int64, int64) error {
	f.deleteCalls++
	return f.deleteErr
}

func newTestRepo(t *testing.T, phase string, legacy *fakeLegacy, proxy *fakeProxy, userSvc user.Service) *migrationRepository {
	t.Helper()
	return &migrationRepository{
		legacy:  legacy,
		proxy:   proxy,
		cfg:     &setting.Cfg{AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{APIMigrationPhase: phase}},
		userSvc: userSvc,
		logger:  log.New("test"),
	}
}

func item(id, timeEnd int64) *annotations.ItemDTO {
	return &annotations.ItemDTO{ID: id, TimeEnd: timeEnd}
}

// --- constructor -----------------------------------------------------------

func TestNewMigrationRepository(t *testing.T) {
	t.Run("returns the legacy repository unchanged when the proxy is off", func(t *testing.T) {
		legacy := &fakeLegacy{}
		cfg := &setting.Cfg{AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{APIMigrationPhase: "off"}}

		got := NewMigrationRepository(legacy, nil, cfg, usertest.NewUserServiceFake())
		assert.Same(t, legacy, got)
	})

	t.Run("returns the wrapper when the proxy is enabled", func(t *testing.T) {
		legacy := &fakeLegacy{}
		cfg := &setting.Cfg{AnnotationAppPlatform: setting.AnnotationAppPlatformSettings{APIMigrationPhase: "proxy-writes"}}

		got := NewMigrationRepository(legacy, nil, cfg, usertest.NewUserServiceFake())
		assert.IsType(t, &migrationRepository{}, got)
	})
}

// --- Find ------------------------------------------------------------------

func TestMigrationRepository_Find(t *testing.T) {
	t.Run("alert query reads legacy only", func(t *testing.T) {
		for _, query := range []*annotations.ItemQuery{
			{Type: "alert"},
			{AlertID: 7},
			{AlertUID: "abc"},
		} {
			legacy := &fakeLegacy{findResult: []*annotations.ItemDTO{item(1, 10)}}
			proxy := &fakeProxy{}
			repo := newTestRepo(t, "proxy-all", legacy, proxy, usertest.NewUserServiceFake())

			got, err := repo.Find(context.Background(), query)
			require.NoError(t, err)
			assert.Equal(t, []*annotations.ItemDTO{item(1, 10)}, got)
			assert.Len(t, legacy.findCalls, 1)
			assert.Empty(t, proxy.listCalls)
			assert.Zero(t, proxy.getCalls)
		}
	})

	t.Run("by-id reads new store", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{getResult: item(5, 10)}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{AnnotationID: 5})
		require.NoError(t, err)
		assert.Equal(t, []*annotations.ItemDTO{item(5, 10)}, got)
		assert.Equal(t, 1, proxy.getCalls)
		assert.Empty(t, legacy.findCalls)
	})

	// The RBAC scope resolver reads a proxy-only annotation's DashboardUID by id; pin that it
	// survives proxy routing.
	t.Run("by-id returns the new-store annotation's DashboardUID", func(t *testing.T) {
		uid := "dash-1"
		proxy := &fakeProxy{getResult: &annotations.ItemDTO{ID: 5, DashboardUID: &uid}}
		repo := newTestRepo(t, "proxy-all", &fakeLegacy{}, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{AnnotationID: 5})
		require.NoError(t, err)
		require.Len(t, got, 1)
		require.NotNil(t, got[0].DashboardUID)
		assert.Equal(t, uid, *got[0].DashboardUID)
	})

	t.Run("by-id falls back to legacy on ErrNotFound", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: []*annotations.ItemDTO{item(5, 10)}}
		proxy := &fakeProxy{getErr: ErrNotFound}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{AnnotationID: 5})
		require.NoError(t, err)
		assert.Equal(t, []*annotations.ItemDTO{item(5, 10)}, got)
		assert.Equal(t, 1, proxy.getCalls)
		assert.Len(t, legacy.findCalls, 1)
	})

	t.Run("by-id propagates other proxy errors", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{getErr: assert.AnError}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		_, err := repo.Find(context.Background(), &annotations.ItemQuery{AnnotationID: 5})
		require.ErrorIs(t, err, assert.AnError)
		assert.Empty(t, legacy.findCalls)
	})

	t.Run("proxy-writes merges new and legacy", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: []*annotations.ItemDTO{item(2, 20)}}
		proxy := &fakeProxy{listResult: []*annotations.ItemDTO{item(1, 10)}}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{Limit: 10})
		require.NoError(t, err)
		assert.Equal(t, []*annotations.ItemDTO{item(2, 20), item(1, 10)}, got)
		assert.Len(t, proxy.listCalls, 1)
		assert.Len(t, legacy.findCalls, 1)
	})

	t.Run("proxy-writes falls back to legacy when the new store errors", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: []*annotations.ItemDTO{item(2, 20)}}
		proxy := &fakeProxy{listErr: errors.New("new store down")}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{Limit: 10})
		require.NoError(t, err)
		assert.Equal(t, []*annotations.ItemDTO{item(2, 20)}, got)
	})

	t.Run("proxy-all returns the error when the new store errors", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: []*annotations.ItemDTO{item(2, 20)}}
		proxy := &fakeProxy{listErr: errors.New("new store down")}
		repo := newTestRepo(t, "proxy-all", legacy, proxy, usertest.NewUserServiceFake())

		_, err := repo.Find(context.Background(), &annotations.ItemQuery{Limit: 10})
		require.Error(t, err)
		assert.Empty(t, legacy.findCalls)
	})

	t.Run("proxy-all with type=annotation reads new store only", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{listResult: []*annotations.ItemDTO{item(1, 10)}}
		repo := newTestRepo(t, "proxy-all", legacy, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{Type: "annotation", Limit: 10})
		require.NoError(t, err)
		assert.Equal(t, []*annotations.ItemDTO{item(1, 10)}, got)
		assert.Empty(t, legacy.findCalls)
	})

	t.Run("proxy-all unfiltered merges new with legacy alerts", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: []*annotations.ItemDTO{item(2, 20)}}
		proxy := &fakeProxy{listResult: []*annotations.ItemDTO{item(1, 10)}}
		repo := newTestRepo(t, "proxy-all", legacy, proxy, usertest.NewUserServiceFake())

		got, err := repo.Find(context.Background(), &annotations.ItemQuery{Limit: 10})
		require.NoError(t, err)
		assert.Equal(t, []*annotations.ItemDTO{item(2, 20), item(1, 10)}, got)
		require.Len(t, legacy.findCalls, 1)
		assert.Equal(t, "alert", legacy.findCalls[0].Type)
	})

	t.Run("resolves UserUID from UserID before listing", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{}
		userSvc := usertest.NewUserServiceFake()
		userSvc.ExpectedUser = &user.User{ID: 42, UID: "user-uid-42"}
		repo := newTestRepo(t, "proxy-all", legacy, proxy, userSvc)

		query := &annotations.ItemQuery{Type: "annotation", UserID: 42}
		_, err := repo.Find(context.Background(), query)
		require.NoError(t, err)
		require.Len(t, proxy.listCalls, 1)
		assert.Equal(t, "user-uid-42", proxy.listCalls[0].UserUID)
	})

	t.Run("user lookup failure proceeds without the createdBy filter", func(t *testing.T) {
		userSvc := usertest.NewUserServiceFake()
		userSvc.ExpectedError = errors.New("not found")
		repo := newTestRepo(t, "proxy-all", &fakeLegacy{}, &fakeProxy{}, userSvc)

		query := &annotations.ItemQuery{Type: "annotation", UserID: 42}
		_, err := repo.Find(context.Background(), query)
		require.NoError(t, err)
		assert.Empty(t, query.UserUID)
	})
}

// --- legacyToMerge ---------------------------------------------------------

func TestMigrationRepository_legacyToMerge(t *testing.T) {
	legacyItems := []*annotations.ItemDTO{item(2, 20)}

	t.Run("proxy-writes merges all legacy items for the query", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: legacyItems}
		repo := newTestRepo(t, "proxy-writes", legacy, &fakeProxy{}, usertest.NewUserServiceFake())

		got, err := repo.legacyToMerge(context.Background(), &annotations.ItemQuery{Limit: 10})
		require.NoError(t, err)
		assert.Equal(t, legacyItems, got)
		require.Len(t, legacy.findCalls, 1)
		assert.Empty(t, legacy.findCalls[0].Type)
	})

	t.Run("proxy-all with type=annotation needs no legacy", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: legacyItems}
		repo := newTestRepo(t, "proxy-all", legacy, &fakeProxy{}, usertest.NewUserServiceFake())

		got, err := repo.legacyToMerge(context.Background(), &annotations.ItemQuery{Type: "annotation"})
		require.NoError(t, err)
		assert.Nil(t, got)
		assert.Empty(t, legacy.findCalls)
	})

	t.Run("proxy-all unfiltered fetches only legacy alerts", func(t *testing.T) {
		legacy := &fakeLegacy{findResult: legacyItems}
		repo := newTestRepo(t, "proxy-all", legacy, &fakeProxy{}, usertest.NewUserServiceFake())

		got, err := repo.legacyToMerge(context.Background(), &annotations.ItemQuery{Limit: 10})
		require.NoError(t, err)
		assert.Equal(t, legacyItems, got)
		require.Len(t, legacy.findCalls, 1)
		assert.Equal(t, "alert", legacy.findCalls[0].Type)
	})
}

// --- Save ------------------------------------------------------------------

func TestMigrationRepository_Save(t *testing.T) {
	t.Run("writes to new store and reflects the legacy ID onto the item", func(t *testing.T) {
		proxy := &fakeProxy{createID: 42}
		repo := newTestRepo(t, "proxy-writes", &fakeLegacy{}, proxy, usertest.NewUserServiceFake())

		item := &annotations.Item{OrgID: 1, Text: "hello"}
		require.NoError(t, repo.Save(context.Background(), item))
		assert.Equal(t, int64(42), item.ID)
		require.Len(t, proxy.createItems, 1)
		assert.Same(t, item, proxy.createItems[0])
	})

	t.Run("propagates proxy error and leaves the item ID untouched", func(t *testing.T) {
		proxy := &fakeProxy{createErr: assert.AnError}
		repo := newTestRepo(t, "proxy-writes", &fakeLegacy{}, proxy, usertest.NewUserServiceFake())

		item := &annotations.Item{OrgID: 1}
		require.ErrorIs(t, repo.Save(context.Background(), item), assert.AnError)
		assert.Zero(t, item.ID)
	})
}

// --- Update ----------------------------------------------------------------

func TestMigrationRepository_Update(t *testing.T) {
	t.Run("writes to new store and does not touch legacy", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		require.NoError(t, repo.Update(context.Background(), &annotations.Item{OrgID: 1, ID: 5}))
		assert.Equal(t, 1, proxy.updateCalls)
		assert.Empty(t, legacy.updateItems)
	})

	t.Run("propagates non-NotFound proxy errors", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{updateErr: assert.AnError}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		require.ErrorIs(t, repo.Update(context.Background(), &annotations.Item{OrgID: 1, ID: 5}), assert.AnError)
		assert.Empty(t, legacy.updateItems)
	})

	t.Run("ErrNotFound falls back to legacy", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{updateErr: ErrNotFound}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		item := &annotations.Item{OrgID: 1, ID: 5, Text: "edited"}
		require.NoError(t, repo.Update(context.Background(), item))
		require.Len(t, legacy.updateItems, 1)
		assert.Same(t, item, legacy.updateItems[0])
	})
}

// --- Delete ----------------------------------------------------------------

func TestMigrationRepository_Delete(t *testing.T) {
	t.Run("single delete hits new store and skips legacy", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		require.NoError(t, repo.Delete(context.Background(), &annotations.DeleteParams{OrgID: 1, ID: 5}))
		assert.Equal(t, 1, proxy.deleteCalls)
		assert.Empty(t, legacy.deleteParams)
	})

	t.Run("single delete propagates non-NotFound proxy errors", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{deleteErr: assert.AnError}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		require.ErrorIs(t, repo.Delete(context.Background(), &annotations.DeleteParams{OrgID: 1, ID: 5}), assert.AnError)
		assert.Empty(t, legacy.deleteParams)
	})

	t.Run("single delete falls back to legacy on ErrNotFound", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{deleteErr: ErrNotFound}
		repo := newTestRepo(t, "proxy-writes", legacy, proxy, usertest.NewUserServiceFake())

		require.NoError(t, repo.Delete(context.Background(), &annotations.DeleteParams{OrgID: 1, ID: 5}))
		assert.Equal(t, 1, proxy.deleteCalls)
		require.Len(t, legacy.deleteParams, 1)
	})

	t.Run("mass delete by dashboard/panel goes straight to legacy", func(t *testing.T) {
		legacy := &fakeLegacy{}
		proxy := &fakeProxy{}
		repo := newTestRepo(t, "proxy-all", legacy, proxy, usertest.NewUserServiceFake())

		require.NoError(t, repo.Delete(context.Background(), &annotations.DeleteParams{OrgID: 1, DashboardID: 9, PanelID: 2}))
		assert.Zero(t, proxy.deleteCalls)
		require.Len(t, legacy.deleteParams, 1)
	})
}
