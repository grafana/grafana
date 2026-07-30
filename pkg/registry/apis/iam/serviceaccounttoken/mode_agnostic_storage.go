package serviceaccounttoken

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"time"

	claims "github.com/grafana/authlib/types"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/iam/common"
	"github.com/grafana/grafana/pkg/registry/apis/iam/legacy"
	"github.com/grafana/grafana/pkg/registry/apis/iam/serviceaccounttoken/contracts"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/storage/legacysql"
	satoken "github.com/grafana/grafana/pkg/storage/serviceaccount/token"
)

var errServiceAccountNotFound = errors.New("service account not found")

// TokenStorage is the token storage surface shared by the REST handlers and the
// api key authentication client.
type TokenStorage interface {
	Get(ctx context.Context, ns claims.NamespaceInfo, serviceAccountName, name string) (*satoken.Token, error)
	List(ctx context.Context, ns claims.NamespaceInfo, serviceAccountName string, pagination common.Pagination) (*satoken.ListResult, error)
	Create(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTokenCommand) error
	Delete(ctx context.Context, ns claims.NamespaceInfo, serviceAccountName, name string) error
	contracts.TokenFetcher
}

type CreateTokenCommand struct {
	Name               string
	Key                string
	ServiceAccountName string
	SecondsToLive      int64
	Expires            *int64
}

// ModeAgnosticStorage presents one token storage API while routing operations to
// legacy storage, the dedicated token store, or both according to the configured
// dual-writer mode.
type ModeAgnosticStorage struct {
	legacyStore legacy.LegacyIdentityStore
	tokenStore  satoken.Storage
	mode        grafanarest.DualWriterMode
	logger      log.Logger

	// saGetter reads ServiceAccount objects through their own dual writer, so the
	// numeric service account id resolves correctly in every mode. It is only
	// available once the API group is installed, hence SetServiceAccountGetter.
	saGetter rest.Getter
}

var _ TokenStorage = (*ModeAgnosticStorage)(nil)
var _ contracts.TokenFetcher = (*ModeAgnosticStorage)(nil)

// SetServiceAccountGetter supplies the ServiceAccount storage. It is called during
// API group installation, which completes before the server accepts requests.
func (s *ModeAgnosticStorage) SetServiceAccountGetter(getter rest.Getter) {
	s.saGetter = getter
}

// ProvideModeAgnosticStorage builds the storage at wire time so the API group and
// the api key authentication client share one instance. The ServiceAccount getter
// is attached later, once the API group is installed.
func ProvideModeAgnosticStorage(sql db.DB, tokenStore satoken.Storage, cfg *setting.Cfg) *ModeAgnosticStorage {
	mode := grafanarest.Mode0
	if cfg != nil {
		if resCfg, ok := cfg.UnifiedStorage[iamv0.ServiceAccountResourceInfo.GroupResource().String()]; ok {
			mode = resCfg.DualWriterMode
		}
	}

	return NewModeAgnosticStorage(legacy.NewLegacySQLStores(legacysql.NewDatabaseProvider(sql)), tokenStore, mode)
}

func NewModeAgnosticStorage(legacyStore legacy.LegacyIdentityStore, tokenStore satoken.Storage, mode grafanarest.DualWriterMode) *ModeAgnosticStorage {
	if tokenStore == nil || (mode != grafanarest.Mode0 && mode != grafanarest.Mode1 && mode != grafanarest.Mode3 && mode != grafanarest.Mode5) {
		mode = grafanarest.Mode0
	}

	return &ModeAgnosticStorage{
		legacyStore: legacyStore,
		tokenStore:  tokenStore,
		mode:        mode,
		logger:      log.New("grafana-apiserver.serviceaccounttokens.storage"),
	}
}

func (s *ModeAgnosticStorage) Get(ctx context.Context, ns claims.NamespaceInfo, serviceAccountName, name string) (*satoken.Token, error) {
	if s.readsStore() {
		var continueToken int64
		for {
			result, err := s.tokenStore.ListByServiceAccount(ctx, ns.Value, serviceAccountName, common.DefaultListLimit, continueToken)
			if err != nil {
				return nil, err
			}
			for _, token := range result.Items {
				if token.Name == name {
					return token, nil
				}
			}
			if result.Continue == 0 {
				return nil, satoken.ErrTokenNotFound
			}
			continueToken = result.Continue
		}
	}

	token, err := s.legacyStore.GetServiceAccountToken(ctx, ns, legacy.GetServiceAccountTokenQuery{
		Name:              name,
		ServiceAccountUID: serviceAccountName,
	})
	if err != nil {
		return nil, err
	}
	if token == nil {
		return nil, satoken.ErrTokenNotFound
	}
	return tokenFromLegacy(ns.Value, token), nil
}

func (s *ModeAgnosticStorage) List(ctx context.Context, ns claims.NamespaceInfo, serviceAccountName string, pagination common.Pagination) (*satoken.ListResult, error) {
	if s.readsStore() {
		return s.tokenStore.ListByServiceAccount(ctx, ns.Value, serviceAccountName, pagination.Limit, pagination.Continue)
	}

	result, err := s.legacyStore.ListServiceAccountTokens(ctx, ns, legacy.ListServiceAccountTokenQuery{
		UID:        serviceAccountName,
		Pagination: pagination,
	})
	if err != nil {
		return nil, err
	}

	items := make([]*satoken.Token, 0, len(result.Items))
	for i := range result.Items {
		items = append(items, tokenFromLegacy(ns.Value, &result.Items[i]))
	}
	return &satoken.ListResult{Items: items, Continue: result.Continue}, nil
}

func (s *ModeAgnosticStorage) Create(ctx context.Context, ns claims.NamespaceInfo, cmd CreateTokenCommand) error {
	if s.writesLegacy() {
		err := s.legacyStore.CreateServiceAccountTokenWithHash(ctx, ns, legacy.CreateServiceAccountTokenWithHashCommand{
			TokenName:         cmd.Name,
			HashedKey:         cmd.Key,
			ServiceAccountUID: cmd.ServiceAccountName,
			Expires:           cmd.Expires,
		})
		if errors.Is(err, legacy.ErrTokenAlreadyExists) {
			return satoken.ErrTokenDuplicate
		}
		if err != nil {
			return err
		}
	}

	if !s.writesStore() {
		return nil
	}

	_, err := s.tokenStore.Add(ctx, &satoken.AddTokenCommand{
		Namespace:          ns.Value,
		Name:               cmd.Name,
		Key:                cmd.Key,
		ServiceAccountName: cmd.ServiceAccountName,
		SecondsToLive:      cmd.SecondsToLive,
	})
	if err == nil {
		return nil
	}
	if s.storeWriteIsBestEffort() {
		s.logger.FromContext(ctx).Error("failed to write service account token to dedicated store", "error", err, "tokenName", cmd.Name, "serviceAccount", cmd.ServiceAccountName)
		return nil
	}
	return err
}

func (s *ModeAgnosticStorage) Delete(ctx context.Context, ns claims.NamespaceInfo, serviceAccountName, name string) error {
	if s.writesLegacy() {
		serviceAccount, err := s.legacyStore.GetServiceAccountInternalID(ctx, ns, legacy.GetServiceAccountInternalIDQuery{
			OrgID: ns.OrgID,
			UID:   serviceAccountName,
		})
		if err != nil {
			return err
		}
		if serviceAccount == nil {
			return errServiceAccountNotFound
		}

		rowsAffected, err := s.legacyStore.DeleteServiceAccountToken(ctx, ns, legacy.DeleteServiceAccountTokenCommand{
			Name:             name,
			ServiceAccountID: serviceAccount.ID,
		})
		if err != nil {
			return err
		}
		if rowsAffected == 0 {
			return satoken.ErrTokenNotFound
		}
	}

	if !s.writesStore() {
		return nil
	}

	err := s.tokenStore.Delete(ctx, ns.Value, serviceAccountName, name)
	switch {
	case err == nil:
		return nil
	case s.storeWriteIsBestEffort():
		s.logger.FromContext(ctx).Error("failed to delete service account token from dedicated store", "error", err, "tokenName", name, "serviceAccount", serviceAccountName)
		return nil
	case errors.Is(err, satoken.ErrTokenNotFound) && s.writesLegacy():
		s.logger.FromContext(ctx).Warn("service account token missing from dedicated store on delete", "tokenName", name, "serviceAccount", serviceAccountName)
		return nil
	default:
		return err
	}
}

// GetByHash resolves a token from its hashed key, scoped to ns.
func (s *ModeAgnosticStorage) GetByHash(ctx context.Context, ns claims.NamespaceInfo, hash string) (*contracts.TokenInfo, error) {
	if s.readsStore() {
		token, err := s.tokenStore.GetByHash(ctx, ns.Value, hash)
		if err != nil {
			return nil, err
		}

		serviceAccountID, err := s.serviceAccountInternalID(ctx, ns, token.ServiceAccountName)
		if err != nil {
			return nil, err
		}

		return &contracts.TokenInfo{Token: token, ServiceAccountID: serviceAccountID, LastUsedID: token.ID}, nil
	}

	token, err := s.legacyStore.GetServiceAccountTokenByHash(ctx, ns, legacy.GetServiceAccountTokenByHashQuery{Hash: hash})
	if err != nil {
		return nil, err
	}
	if token == nil {
		return nil, satoken.ErrTokenNotFound
	}

	return &contracts.TokenInfo{
		Token:            tokenFromLegacy(ns.Value, token),
		ID:               token.ID,
		ServiceAccountID: token.ServiceAccountID,
		LastUsedID:       strconv.FormatInt(token.ID, 10),
	}, nil
}

// UpdateLastUsedDate stamps last_used_at on the token behind lastUsedID, which the
// dedicated store keys by UUID and legacy keys by numeric row id.
func (s *ModeAgnosticStorage) UpdateLastUsedDate(ctx context.Context, ns claims.NamespaceInfo, lastUsedID string) error {
	if lastUsedID == "" {
		return satoken.ErrTokenNotFound
	}

	if s.readsStore() {
		return s.tokenStore.UpdateLastUsedDate(ctx, ns.Value, lastUsedID)
	}

	id, err := strconv.ParseInt(lastUsedID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid legacy token id %q: %w", lastUsedID, err)
	}

	return s.legacyStore.UpdateServiceAccountTokenLastUsed(ctx, ns, legacy.UpdateServiceAccountTokenLastUsedCommand{
		ID:         id,
		LastUsedAt: time.Now().UTC(),
	})
}

// serviceAccountInternalID reads the numeric id off the ServiceAccount object's
// deprecated internal id label. Going through the ServiceAccount storage keeps this
// correct in every mode, since that resource dual writes on its own.
func (s *ModeAgnosticStorage) serviceAccountInternalID(ctx context.Context, ns claims.NamespaceInfo, name string) (int64, error) {
	if s.saGetter == nil {
		return 0, errServiceAccountNotFound
	}

	// The ServiceAccount storage reads the namespace and identity off the context.
	// Authentication calls this without a k8s request context, so supply both.
	ctx = k8srequest.WithNamespace(ctx, ns.Value)
	ctx = identity.WithServiceIdentityForSingleNamespaceContext(ctx, ns.Value)

	obj, err := s.saGetter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return 0, err
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return 0, err
	}

	id := meta.GetDeprecatedInternalID() // nolint:staticcheck
	if id < 1 {
		return 0, errServiceAccountNotFound
	}
	return id, nil
}

func (s *ModeAgnosticStorage) writesLegacy() bool {
	return s.mode != grafanarest.Mode5
}

func (s *ModeAgnosticStorage) writesStore() bool {
	return s.mode == grafanarest.Mode1 || s.mode == grafanarest.Mode3 || s.mode == grafanarest.Mode5
}

func (s *ModeAgnosticStorage) readsStore() bool {
	return s.mode == grafanarest.Mode3 || s.mode == grafanarest.Mode5
}

func (s *ModeAgnosticStorage) storeWriteIsBestEffort() bool {
	return s.mode == grafanarest.Mode1
}

func tokenFromLegacy(namespace string, token *legacy.ServiceAccountToken) *satoken.Token {
	revoked := token.Revoked
	return &satoken.Token{
		Namespace:          namespace,
		Name:               token.Name,
		Created:            token.Created,
		Updated:            token.Updated,
		LastUsedAt:         token.LastUsed,
		ServiceAccountName: token.ServiceAccountUID,
		IsRevoked:          &revoked,
		Expires:            token.Expires,
	}
}
