package serviceaccounttoken

import (
	"context"
	"errors"
	"strconv"
	"testing"

	claims "github.com/grafana/authlib/types"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

type stubStorage struct {
	satoken.Storage
	addErr      error
	deleteErr   error
	getToken    *satoken.Token
	addCalls    int
	deleteCalls int
	listCalls   int

	getByHashToken     *satoken.Token
	getByHashCalls     int
	getByHashNamespace string

	updateLastUsedCalls     int
	updateLastUsedID        string
	updateLastUsedNamespace string
	updateLastUsedErr       error
}

func (s *stubStorage) Add(_ context.Context, _ *satoken.AddTokenCommand) (*satoken.Token, error) {
	s.addCalls++
	return nil, s.addErr
}

func (s *stubStorage) Delete(_ context.Context, _, _, _ string) error {
	s.deleteCalls++
	return s.deleteErr
}

func (s *stubStorage) UpdateLastUsedDate(_ context.Context, namespace, id string) error {
	s.updateLastUsedCalls++
	s.updateLastUsedNamespace = namespace
	s.updateLastUsedID = id
	return s.updateLastUsedErr
}

func (s *stubStorage) GetByHash(_ context.Context, namespace, _ string) (*satoken.Token, error) {
	s.getByHashCalls++
	s.getByHashNamespace = namespace
	if s.getByHashToken == nil {
		return nil, satoken.ErrTokenNotFound
	}
	return s.getByHashToken, nil
}

func (s *stubStorage) ListByServiceAccount(_ context.Context, _, _ string, _, _ int64) (*satoken.ListResult, error) {
	s.listCalls++
	return &satoken.ListResult{Items: []*satoken.Token{s.getToken}}, nil
}

type stubLegacyStorage struct {
	legacy.LegacyIdentityStore
	createErr             error
	getToken              *legacy.ServiceAccountToken
	serviceAccountMissing bool
	deleteRows            int64
	createCalls           int
	deleteCalls           int
	getCalls              int

	getByHashToken *legacy.ServiceAccountToken
	getByHashCalls int

	updateLastUsedCalls int
	updateLastUsedID    int64
}

func (s *stubLegacyStorage) CreateServiceAccountTokenWithHash(_ context.Context, _ claims.NamespaceInfo, _ legacy.CreateServiceAccountTokenWithHashCommand) error {
	s.createCalls++
	return s.createErr
}

func (s *stubLegacyStorage) UpdateServiceAccountTokenLastUsed(_ context.Context, _ claims.NamespaceInfo, cmd legacy.UpdateServiceAccountTokenLastUsedCommand) error {
	s.updateLastUsedCalls++
	s.updateLastUsedID = cmd.ID
	return nil
}

func (s *stubLegacyStorage) GetServiceAccountTokenByHash(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetServiceAccountTokenByHashQuery) (*legacy.ServiceAccountToken, error) {
	s.getByHashCalls++
	return s.getByHashToken, nil
}

func (s *stubLegacyStorage) DeleteServiceAccountToken(_ context.Context, _ claims.NamespaceInfo, _ legacy.DeleteServiceAccountTokenCommand) (int64, error) {
	s.deleteCalls++
	return s.deleteRows, nil
}

func (s *stubLegacyStorage) GetServiceAccountInternalID(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetServiceAccountInternalIDQuery) (*legacy.GetServiceAccountInternalIDResult, error) {
	if s.serviceAccountMissing {
		return nil, nil
	}
	return &legacy.GetServiceAccountInternalIDResult{ID: 1}, nil
}

func (s *stubLegacyStorage) GetServiceAccountToken(_ context.Context, _ claims.NamespaceInfo, _ legacy.GetServiceAccountTokenQuery) (*legacy.ServiceAccountToken, error) {
	s.getCalls++
	return s.getToken, nil
}

func TestModeRouting(t *testing.T) {
	// Mirrors the table in pkg/apiserver/rest/dualwriter.go for the modes the token
	// endpoints support.
	for _, tc := range []struct {
		mode            grafanarest.DualWriterMode
		writesLegacy    bool
		writesStore     bool
		readsStore      bool
		storeBestEffort bool
	}{
		{mode: grafanarest.Mode0, writesLegacy: true, writesStore: false, readsStore: false, storeBestEffort: false},
		{mode: grafanarest.Mode1, writesLegacy: true, writesStore: true, readsStore: false, storeBestEffort: true},
		{mode: grafanarest.Mode3, writesLegacy: true, writesStore: true, readsStore: true, storeBestEffort: false},
		{mode: grafanarest.Mode5, writesLegacy: false, writesStore: true, readsStore: true, storeBestEffort: false},
	} {
		t.Run(modeName(tc.mode), func(t *testing.T) {
			s := NewModeAgnosticStorage(nil, &stubStorage{}, tc.mode)

			require.Equal(t, tc.writesLegacy, s.writesLegacy(), "writesLegacy")
			require.Equal(t, tc.writesStore, s.writesStore(), "writesStore")
			require.Equal(t, tc.readsStore, s.readsStore(), "readsStore")
			require.Equal(t, tc.storeBestEffort, s.storeWriteIsBestEffort(), "storeWriteIsBestEffort")
		})
	}
}

func TestUnsupportedModeFallsBackToLegacyOnly(t *testing.T) {
	// Mode2 and Mode4 are not implemented here; they must not silently read or write
	// the token store.
	for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode2, grafanarest.Mode4} {
		t.Run(modeName(mode), func(t *testing.T) {
			s := NewModeAgnosticStorage(nil, &stubStorage{}, mode)

			require.Equal(t, grafanarest.Mode0, s.mode)
			require.True(t, s.writesLegacy())
			require.False(t, s.writesStore())
			require.False(t, s.readsStore())
		})
	}
}

func TestNilTokenStoreForcesLegacyOnly(t *testing.T) {
	// The multi-tenant builder passes no token store, so a configured mode must not
	// cause a nil dereference.
	s := NewModeAgnosticStorage(nil, nil, grafanarest.Mode5)

	require.Equal(t, grafanarest.Mode0, s.mode)
	require.True(t, s.writesLegacy())
	require.False(t, s.writesStore())
	require.False(t, s.readsStore())
}

func TestModeAgnosticStorageRoutesReads(t *testing.T) {
	ns := claims.NamespaceInfo{Value: "ns", OrgID: 1}
	for _, tc := range []struct {
		mode              grafanarest.DualWriterMode
		expectedName      string
		expectedLegacyGet int
		expectedStoreGet  int
	}{
		{mode: grafanarest.Mode0, expectedName: "legacy", expectedLegacyGet: 1},
		{mode: grafanarest.Mode1, expectedName: "legacy", expectedLegacyGet: 1},
		{mode: grafanarest.Mode3, expectedName: "store", expectedStoreGet: 1},
		{mode: grafanarest.Mode5, expectedName: "store", expectedStoreGet: 1},
	} {
		t.Run(modeName(tc.mode), func(t *testing.T) {
			legacyStore := &stubLegacyStorage{getToken: &legacy.ServiceAccountToken{Name: "legacy"}}
			tokenStore := &stubStorage{getToken: &satoken.Token{Name: "store"}}
			storage := NewModeAgnosticStorage(legacyStore, tokenStore, tc.mode)

			token, err := storage.Get(context.Background(), ns, "sa", tc.expectedName)

			require.NoError(t, err)
			require.Equal(t, tc.expectedName, token.Name)
			require.Equal(t, tc.expectedLegacyGet, legacyStore.getCalls)
			require.Equal(t, tc.expectedStoreGet, tokenStore.listCalls)
		})
	}
}

func TestModeAgnosticStorageRoutesWrites(t *testing.T) {
	ns := claims.NamespaceInfo{Value: "ns", OrgID: 1}
	for _, tc := range []struct {
		mode                 grafanarest.DualWriterMode
		expectedLegacyWrites int
		expectedStoreWrites  int
	}{
		{mode: grafanarest.Mode0, expectedLegacyWrites: 1},
		{mode: grafanarest.Mode1, expectedLegacyWrites: 1, expectedStoreWrites: 1},
		{mode: grafanarest.Mode3, expectedLegacyWrites: 1, expectedStoreWrites: 1},
		{mode: grafanarest.Mode5, expectedStoreWrites: 1},
	} {
		t.Run(modeName(tc.mode), func(t *testing.T) {
			legacyStore := &stubLegacyStorage{}
			tokenStore := &stubStorage{}
			storage := NewModeAgnosticStorage(legacyStore, tokenStore, tc.mode)

			err := storage.Create(context.Background(), ns, CreateTokenCommand{Name: "token", ServiceAccountName: "sa"})

			require.NoError(t, err)
			require.Equal(t, tc.expectedLegacyWrites, legacyStore.createCalls)
			require.Equal(t, tc.expectedStoreWrites, tokenStore.addCalls)
		})
	}
}

func TestModeAgnosticStorageStoreWriteFailures(t *testing.T) {
	ns := claims.NamespaceInfo{Value: "ns", OrgID: 1}
	storeErr := errors.New("store failed")

	t.Run("Mode1 is best effort", func(t *testing.T) {
		storage := NewModeAgnosticStorage(&stubLegacyStorage{}, &stubStorage{addErr: storeErr}, grafanarest.Mode1)
		require.NoError(t, storage.Create(context.Background(), ns, CreateTokenCommand{Name: "token", ServiceAccountName: "sa"}))
	})

	t.Run("Mode3 returns the error", func(t *testing.T) {
		storage := NewModeAgnosticStorage(&stubLegacyStorage{}, &stubStorage{addErr: storeErr}, grafanarest.Mode3)
		require.ErrorIs(t, storage.Create(context.Background(), ns, CreateTokenCommand{Name: "token", ServiceAccountName: "sa"}), storeErr)
	})

	t.Run("legacy duplicate is normalized and stops the store write", func(t *testing.T) {
		tokenStore := &stubStorage{}
		storage := NewModeAgnosticStorage(&stubLegacyStorage{createErr: legacy.ErrTokenAlreadyExists}, tokenStore, grafanarest.Mode3)
		require.ErrorIs(t, storage.Create(context.Background(), ns, CreateTokenCommand{Name: "token", ServiceAccountName: "sa"}), satoken.ErrTokenDuplicate)
		require.Zero(t, tokenStore.addCalls)
	})
}

func TestModeAgnosticStorageDeleteReconcilesMissingStoreToken(t *testing.T) {
	ns := claims.NamespaceInfo{Value: "ns", OrgID: 1}

	t.Run("Mode3 accepts drift after a legacy delete", func(t *testing.T) {
		storage := NewModeAgnosticStorage(
			&stubLegacyStorage{deleteRows: 1},
			&stubStorage{deleteErr: satoken.ErrTokenNotFound},
			grafanarest.Mode3,
		)
		require.NoError(t, storage.Delete(context.Background(), ns, "sa", "token"))
	})

	t.Run("Mode5 returns not found from the source of truth", func(t *testing.T) {
		storage := NewModeAgnosticStorage(
			&stubLegacyStorage{},
			&stubStorage{deleteErr: satoken.ErrTokenNotFound},
			grafanarest.Mode5,
		)
		require.ErrorIs(t, storage.Delete(context.Background(), ns, "sa", "token"), satoken.ErrTokenNotFound)
	})

	t.Run("preserves a missing legacy service account", func(t *testing.T) {
		storage := NewModeAgnosticStorage(
			&stubLegacyStorage{serviceAccountMissing: true},
			&stubStorage{},
			grafanarest.Mode0,
		)
		require.ErrorIs(t, storage.Delete(context.Background(), ns, "sa", "token"), errServiceAccountNotFound)
	})
}

func modeName(m grafanarest.DualWriterMode) string {
	switch m {
	case grafanarest.Mode0:
		return "Mode0"
	case grafanarest.Mode1:
		return "Mode1"
	case grafanarest.Mode2:
		return "Mode2"
	case grafanarest.Mode3:
		return "Mode3"
	case grafanarest.Mode4:
		return "Mode4"
	case grafanarest.Mode5:
		return "Mode5"
	default:
		return "unknown"
	}
}

// stubServiceAccountGetter returns a ServiceAccount carrying the deprecated internal
// id label, which is where the numeric id comes from in the store-read modes.
type stubServiceAccountGetter struct {
	internalID int64
	err        error
	calls      int
	namespace  string
}

func (g *stubServiceAccountGetter) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	g.calls++
	if g.err != nil {
		return nil, g.err
	}

	// The real ServiceAccount storage reads the namespace off the context, so the
	// caller must put it there. Authentication has no k8s request context of its own.
	g.namespace = k8srequest.NamespaceValue(ctx)
	if g.namespace == "" {
		return nil, errors.New("missing namespace in context")
	}

	sa := &iamv0.ServiceAccount{}
	sa.Name = name
	if g.internalID != 0 {
		sa.Labels = map[string]string{utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(g.internalID, 10)}
	}
	return sa, nil
}

var testNamespaceInfo = claims.NamespaceInfo{Value: "default", OrgID: 1}

func TestGetByHashReadsLegacyBelowMode3(t *testing.T) {
	for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode0, grafanarest.Mode1} {
		t.Run(modeName(mode), func(t *testing.T) {
			legacyStore := &stubLegacyStorage{getByHashToken: &legacy.ServiceAccountToken{
				ID:                7,
				Name:              "token-a",
				ServiceAccountUID: "sa-uid",
				ServiceAccountID:  42,
			}}
			tokenStore := &stubStorage{}
			storage := NewModeAgnosticStorage(legacyStore, tokenStore, mode)

			info, err := storage.GetByHash(context.Background(), testNamespaceInfo, "hashed-a")

			require.NoError(t, err)
			require.Equal(t, 1, legacyStore.getByHashCalls)
			require.Zero(t, tokenStore.getByHashCalls, "the token store must not be read below Mode3")
			require.Equal(t, int64(7), info.ID, "the legacy row id is available")
			require.Equal(t, "7", info.LastUsedID, "legacy keys rows by numeric id")
			require.Equal(t, int64(42), info.ServiceAccountID)
			require.Equal(t, "token-a", info.Token.Name)
		})
	}
}

func TestGetByHashMissingLegacyTokenIsNotFound(t *testing.T) {
	storage := NewModeAgnosticStorage(&stubLegacyStorage{}, &stubStorage{}, grafanarest.Mode1)

	_, err := storage.GetByHash(context.Background(), testNamespaceInfo, "nope")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}

func TestGetByHashReadsStoreFromMode3(t *testing.T) {
	for _, mode := range []grafanarest.DualWriterMode{grafanarest.Mode3, grafanarest.Mode5} {
		t.Run(modeName(mode), func(t *testing.T) {
			legacyStore := &stubLegacyStorage{}
			tokenStore := &stubStorage{getByHashToken: &satoken.Token{
				ID:                 "token-uuid",
				Namespace:          "default",
				Name:               "token-a",
				ServiceAccountName: "sa-uid",
			}}
			storage := NewModeAgnosticStorage(legacyStore, tokenStore, mode)
			saGetter := &stubServiceAccountGetter{internalID: 42}
			storage.SetServiceAccountGetter(saGetter)

			info, err := storage.GetByHash(context.Background(), testNamespaceInfo, "hashed-a")

			require.NoError(t, err)
			require.Equal(t, 1, tokenStore.getByHashCalls)
			require.Equal(t, "default", tokenStore.getByHashNamespace, "the lookup must be namespace scoped")
			require.Zero(t, legacyStore.getByHashCalls, "legacy must not be read from Mode3 up")
			require.Equal(t, 1, saGetter.calls)
			require.Equal(t, "default", saGetter.namespace, "the namespace must reach the ServiceAccount storage")
			require.Equal(t, int64(42), info.ServiceAccountID, "read off the deprecated internal id label")
			require.Zero(t, info.ID, "the dedicated store has no numeric row id")
			require.Equal(t, "token-uuid", info.LastUsedID, "the store keys rows by uuid")
		})
	}
}

func TestGetByHashFailsWhenTheServiceAccountHasNoInternalID(t *testing.T) {
	tokenStore := &stubStorage{getByHashToken: &satoken.Token{ServiceAccountName: "sa-uid"}}
	storage := NewModeAgnosticStorage(&stubLegacyStorage{}, tokenStore, grafanarest.Mode5)
	storage.SetServiceAccountGetter(&stubServiceAccountGetter{})

	_, err := storage.GetByHash(context.Background(), testNamespaceInfo, "hashed-a")

	require.ErrorIs(t, err, errServiceAccountNotFound)
}

func TestGetByHashFailsWithoutAServiceAccountGetter(t *testing.T) {
	// The getter is attached at API group install time; a store-read mode cannot
	// resolve the numeric id before that.
	tokenStore := &stubStorage{getByHashToken: &satoken.Token{ServiceAccountName: "sa-uid"}}
	storage := NewModeAgnosticStorage(&stubLegacyStorage{}, tokenStore, grafanarest.Mode5)

	_, err := storage.GetByHash(context.Background(), testNamespaceInfo, "hashed-a")

	require.ErrorIs(t, err, errServiceAccountNotFound)
}

func TestUpdateLastUsedDateRoutesByMode(t *testing.T) {
	t.Run("legacy below Mode3", func(t *testing.T) {
		legacyStore := &stubLegacyStorage{}
		tokenStore := &stubStorage{}
		storage := NewModeAgnosticStorage(legacyStore, tokenStore, grafanarest.Mode1)

		require.NoError(t, storage.UpdateLastUsedDate(context.Background(), testNamespaceInfo, "7"))

		require.Equal(t, 1, legacyStore.updateLastUsedCalls)
		require.Equal(t, int64(7), legacyStore.updateLastUsedID)
		require.Zero(t, tokenStore.updateLastUsedCalls)
	})

	t.Run("store from Mode3", func(t *testing.T) {
		legacyStore := &stubLegacyStorage{}
		tokenStore := &stubStorage{}
		storage := NewModeAgnosticStorage(legacyStore, tokenStore, grafanarest.Mode3)

		require.NoError(t, storage.UpdateLastUsedDate(context.Background(), testNamespaceInfo, "token-uuid"))

		require.Equal(t, 1, tokenStore.updateLastUsedCalls)
		require.Equal(t, "token-uuid", tokenStore.updateLastUsedID)
		require.Equal(t, "default", tokenStore.updateLastUsedNamespace)
		require.Zero(t, legacyStore.updateLastUsedCalls)
	})
}

func TestUpdateLastUsedDateRejectsANonNumericLegacyID(t *testing.T) {
	// A uuid handle cannot address a legacy row; fail loudly instead of updating
	// nothing silently.
	storage := NewModeAgnosticStorage(&stubLegacyStorage{}, &stubStorage{}, grafanarest.Mode1)

	err := storage.UpdateLastUsedDate(context.Background(), testNamespaceInfo, "token-uuid")

	require.ErrorContains(t, err, "invalid legacy token id")
}

func TestUpdateLastUsedDateWithoutAHandleIsNotFound(t *testing.T) {
	storage := NewModeAgnosticStorage(&stubLegacyStorage{}, &stubStorage{}, grafanarest.Mode3)

	err := storage.UpdateLastUsedDate(context.Background(), testNamespaceInfo, "")

	require.ErrorIs(t, err, satoken.ErrTokenNotFound)
}
