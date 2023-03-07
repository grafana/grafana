package authstorage

import (
	"context"
	"errors"
	"sync"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gopkg.in/square/go-jose.v2"

	"github.com/ory/fosite"

	"github.com/grafana/grafana/pkg/services/oauthserver"
)

type MemoryUserRelation struct {
	Username string
	Password string
}

type IssuerPublicKeys struct {
	Issuer string
	Keys   map[string]PublicKeyScopes
}

type PublicKeyScopes struct {
	Key    *jose.JSONWebKey
	Scopes []string
}

type GrafanaPluginAuthStore struct {
	Config          *fosite.Config
	Clients         map[string]fosite.Client
	Apps            map[string]oauthserver.Client
	AuthorizeCodes  map[string]StoreAuthorizeCode
	IDSessions      map[string]fosite.Requester
	AccessTokens    map[string]fosite.Requester
	RefreshTokens   map[string]StoreRefreshToken
	PKCES           map[string]fosite.Requester
	Users           map[string]MemoryUserRelation
	BlacklistedJTIs map[string]time.Time
	// In-memory request ID to token signatures
	AccessTokenRequestIDs  map[string]string
	RefreshTokenRequestIDs map[string]string
	// Public keys to check signature in auth grant jwt assertion.
	IssuerPublicKeys map[string]IssuerPublicKeys
	PARSessions      map[string]fosite.AuthorizeRequester

	clientsMutex                sync.RWMutex
	authorizeCodesMutex         sync.RWMutex
	idSessionsMutex             sync.RWMutex
	accessTokensMutex           sync.RWMutex
	refreshTokensMutex          sync.RWMutex
	pkcesMutex                  sync.RWMutex
	usersMutex                  sync.RWMutex
	blacklistedJTIsMutex        sync.RWMutex
	accessTokenRequestIDsMutex  sync.RWMutex
	refreshTokenRequestIDsMutex sync.RWMutex
	issuerPublicKeysMutex       sync.RWMutex
	parSessionsMutex            sync.RWMutex
}

func NewMemoryStore() *GrafanaPluginAuthStore {
	return &GrafanaPluginAuthStore{
		Clients:                make(map[string]fosite.Client),
		Apps:                   make(map[string]oauthserver.Client),
		AuthorizeCodes:         make(map[string]StoreAuthorizeCode),
		IDSessions:             make(map[string]fosite.Requester),
		AccessTokens:           make(map[string]fosite.Requester),
		RefreshTokens:          make(map[string]StoreRefreshToken),
		PKCES:                  make(map[string]fosite.Requester),
		Users:                  make(map[string]MemoryUserRelation),
		AccessTokenRequestIDs:  make(map[string]string),
		RefreshTokenRequestIDs: make(map[string]string),
		BlacklistedJTIs:        make(map[string]time.Time),
		IssuerPublicKeys:       make(map[string]IssuerPublicKeys),
		PARSessions:            make(map[string]fosite.AuthorizeRequester),
	}
}

type StoreAuthorizeCode struct {
	active bool
	fosite.Requester
}

type StoreRefreshToken struct {
	active bool
	fosite.Requester
}

func NewGrafanaPluginAuthStore(config *fosite.Config) *GrafanaPluginAuthStore {
	return &GrafanaPluginAuthStore{
		Config:                 config,
		IDSessions:             make(map[string]fosite.Requester),
		Clients:                map[string]fosite.Client{},
		Apps:                   map[string]oauthserver.Client{},
		Users:                  map[string]MemoryUserRelation{},
		AuthorizeCodes:         map[string]StoreAuthorizeCode{},
		AccessTokens:           map[string]fosite.Requester{},
		RefreshTokens:          map[string]StoreRefreshToken{},
		PKCES:                  map[string]fosite.Requester{},
		AccessTokenRequestIDs:  map[string]string{},
		RefreshTokenRequestIDs: map[string]string{},
		IssuerPublicKeys:       map[string]IssuerPublicKeys{},
		PARSessions:            map[string]fosite.AuthorizeRequester{},
		BlacklistedJTIs:        map[string]time.Time{},
	}
}

func (s *GrafanaPluginAuthStore) CreateOpenIDConnectSession(_ context.Context, authorizeCode string, requester fosite.Requester) error {
	s.idSessionsMutex.Lock()
	defer s.idSessionsMutex.Unlock()

	s.IDSessions[authorizeCode] = requester
	return nil
}

func (s *GrafanaPluginAuthStore) GetOpenIDConnectSession(_ context.Context, authorizeCode string, requester fosite.Requester) (fosite.Requester, error) {
	s.idSessionsMutex.RLock()
	defer s.idSessionsMutex.RUnlock()

	cl, ok := s.IDSessions[authorizeCode]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return cl, nil
}

// DeleteOpenIDConnectSession is not really called from anywhere and it is deprecated.
func (s *GrafanaPluginAuthStore) DeleteOpenIDConnectSession(_ context.Context, authorizeCode string) error {
	s.idSessionsMutex.Lock()
	defer s.idSessionsMutex.Unlock()

	delete(s.IDSessions, authorizeCode)
	return nil
}

func (s *GrafanaPluginAuthStore) RegisterClient(ctx context.Context, client *oauthserver.Client) error {
	s.clientsMutex.Lock()
	defer s.clientsMutex.Unlock()

	hashedSecret, err := bcrypt.GenerateFromPassword([]byte(client.Secret), 12) // TODO: consider using fosite.BCrypt
	if err != nil {
		return err
	}

	// Register the client (for now) in the memory
	s.Clients[client.ID] = &fosite.DefaultClient{
		ID:             client.ID,
		Secret:         hashedSecret,
		RotatedSecrets: [][]byte{[]byte(`$2y$10$X51gLxUQJ.hGw1epgHTE5u0bt64xM0COU7K9iAp.OFg8p2pUd.1zC `)}, // = "foobaz",
		GrantTypes:     []string{"client_credentials", "urn:ietf:params:oauth:grant-type:jwt-bearer"},
		Scopes:         []string{"openid", "profile", "email", "teams", "permissions", "org.*"},
		Audience:       []string{client.ID},
	}

	s.Apps[client.ID] = oauthserver.Client{
		ID:               client.ID,
		Secret:           client.Secret,
		Domain:           client.Domain,
		ServiceAccountID: client.ServiceAccountID,
		AppName:          client.AppName,
		RedirectURI:      client.RedirectURI,
		Key: &oauthserver.KeyResult{
			Public: client.Key.Public,
		},
	}
	s.issuerPublicKeysMutex.Lock()
	defer s.issuerPublicKeysMutex.Unlock()

	key := client.Key.Key.PublicKey
	s.IssuerPublicKeys[client.ID] = IssuerPublicKeys{
		Issuer: client.ID,
		Keys: map[string]PublicKeyScopes{
			"1": {
				Key: &jose.JSONWebKey{
					KeyID:     "1",
					Algorithm: "RS256",
					Key:       &key,
				},
				Scopes: s.Clients[client.ID].GetScopes(),
			},
		},
	}

	return nil
}

func (s *GrafanaPluginAuthStore) GetClient(_ context.Context, id string) (fosite.Client, error) {
	s.clientsMutex.RLock()
	defer s.clientsMutex.RUnlock()

	cl, ok := s.Clients[id]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return cl, nil
}

func (s *GrafanaPluginAuthStore) GetApp(_ context.Context, id string) (*oauthserver.Client, error) {
	s.clientsMutex.RLock()
	defer s.clientsMutex.RUnlock()

	app, ok := s.Apps[id]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return &app, nil
}

func (s *GrafanaPluginAuthStore) SetTokenLifespans(clientID string, lifespans *fosite.ClientLifespanConfig) error {
	if client, ok := s.Clients[clientID]; ok {
		if clc, ok := client.(*fosite.DefaultClientWithCustomTokenLifespans); ok {
			clc.SetTokenLifespans(lifespans)
			return nil
		}
		return fosite.ErrorToRFC6749Error(errors.New("failed to set token lifespans due to failed client type assertion"))
	}
	return fosite.ErrNotFound
}

func (s *GrafanaPluginAuthStore) ClientAssertionJWTValid(_ context.Context, jti string) error {
	s.blacklistedJTIsMutex.RLock()
	defer s.blacklistedJTIsMutex.RUnlock()

	if exp, exists := s.BlacklistedJTIs[jti]; exists && exp.After(time.Now()) {
		return fosite.ErrJTIKnown
	}

	return nil
}

func (s *GrafanaPluginAuthStore) SetClientAssertionJWT(_ context.Context, jti string, exp time.Time) error {
	s.blacklistedJTIsMutex.Lock()
	defer s.blacklistedJTIsMutex.Unlock()

	// delete expired jtis
	for j, e := range s.BlacklistedJTIs {
		if e.Before(time.Now()) {
			delete(s.BlacklistedJTIs, j)
		}
	}

	if _, exists := s.BlacklistedJTIs[jti]; exists {
		return fosite.ErrJTIKnown
	}

	s.BlacklistedJTIs[jti] = exp
	return nil
}

func (s *GrafanaPluginAuthStore) CreateAuthorizeCodeSession(_ context.Context, code string, req fosite.Requester) error {
	s.authorizeCodesMutex.Lock()
	defer s.authorizeCodesMutex.Unlock()

	s.AuthorizeCodes[code] = StoreAuthorizeCode{active: true, Requester: req}
	return nil
}

func (s *GrafanaPluginAuthStore) GetAuthorizeCodeSession(_ context.Context, code string, _ fosite.Session) (fosite.Requester, error) {
	s.authorizeCodesMutex.RLock()
	defer s.authorizeCodesMutex.RUnlock()

	rel, ok := s.AuthorizeCodes[code]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	if !rel.active {
		return rel, fosite.ErrInvalidatedAuthorizeCode
	}

	return rel.Requester, nil
}

func (s *GrafanaPluginAuthStore) InvalidateAuthorizeCodeSession(ctx context.Context, code string) error {
	s.authorizeCodesMutex.Lock()
	defer s.authorizeCodesMutex.Unlock()

	rel, ok := s.AuthorizeCodes[code]
	if !ok {
		return fosite.ErrNotFound
	}
	rel.active = false
	s.AuthorizeCodes[code] = rel
	return nil
}

func (s *GrafanaPluginAuthStore) CreatePKCERequestSession(_ context.Context, code string, req fosite.Requester) error {
	s.pkcesMutex.Lock()
	defer s.pkcesMutex.Unlock()

	s.PKCES[code] = req
	return nil
}

func (s *GrafanaPluginAuthStore) GetPKCERequestSession(_ context.Context, code string, _ fosite.Session) (fosite.Requester, error) {
	s.pkcesMutex.RLock()
	defer s.pkcesMutex.RUnlock()

	rel, ok := s.PKCES[code]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return rel, nil
}

func (s *GrafanaPluginAuthStore) DeletePKCERequestSession(_ context.Context, code string) error {
	s.pkcesMutex.Lock()
	defer s.pkcesMutex.Unlock()

	delete(s.PKCES, code)
	return nil
}

func (s *GrafanaPluginAuthStore) CreateAccessTokenSession(_ context.Context, signature string, req fosite.Requester) error {
	// We first lock accessTokenRequestIDsMutex and then accessTokensMutex because this is the same order
	// locking happens in RevokeAccessToken and using the same order prevents deadlocks.
	s.accessTokenRequestIDsMutex.Lock()
	defer s.accessTokenRequestIDsMutex.Unlock()
	s.accessTokensMutex.Lock()
	defer s.accessTokensMutex.Unlock()

	s.AccessTokens[signature] = req
	s.AccessTokenRequestIDs[req.GetID()] = signature
	return nil
}

func (s *GrafanaPluginAuthStore) GetAccessTokenSession(_ context.Context, signature string, _ fosite.Session) (fosite.Requester, error) {
	s.accessTokensMutex.RLock()
	defer s.accessTokensMutex.RUnlock()

	rel, ok := s.AccessTokens[signature]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	return rel, nil
}

func (s *GrafanaPluginAuthStore) DeleteAccessTokenSession(_ context.Context, signature string) error {
	s.accessTokensMutex.Lock()
	defer s.accessTokensMutex.Unlock()

	delete(s.AccessTokens, signature)
	return nil
}

func (s *GrafanaPluginAuthStore) CreateRefreshTokenSession(_ context.Context, signature string, req fosite.Requester) error {
	// We first lock refreshTokenRequestIDsMutex and then refreshTokensMutex because this is the same order
	// locking happens in RevokeRefreshToken and using the same order prevents deadlocks.
	s.refreshTokenRequestIDsMutex.Lock()
	defer s.refreshTokenRequestIDsMutex.Unlock()
	s.refreshTokensMutex.Lock()
	defer s.refreshTokensMutex.Unlock()

	s.RefreshTokens[signature] = StoreRefreshToken{active: true, Requester: req}
	s.RefreshTokenRequestIDs[req.GetID()] = signature
	return nil
}

func (s *GrafanaPluginAuthStore) GetRefreshTokenSession(_ context.Context, signature string, _ fosite.Session) (fosite.Requester, error) {
	s.refreshTokensMutex.RLock()
	defer s.refreshTokensMutex.RUnlock()

	rel, ok := s.RefreshTokens[signature]
	if !ok {
		return nil, fosite.ErrNotFound
	}
	if !rel.active {
		return rel, fosite.ErrInactiveToken
	}
	return rel, nil
}

func (s *GrafanaPluginAuthStore) DeleteRefreshTokenSession(_ context.Context, signature string) error {
	s.refreshTokensMutex.Lock()
	defer s.refreshTokensMutex.Unlock()

	delete(s.RefreshTokens, signature)
	return nil
}

func (s *GrafanaPluginAuthStore) Authenticate(_ context.Context, name string, secret string) error {
	s.usersMutex.RLock()
	defer s.usersMutex.RUnlock()

	rel, ok := s.Users[name]
	if !ok {
		return fosite.ErrNotFound
	}
	if rel.Password != secret {
		return fosite.ErrNotFound.WithDebug("Invalid credentials")
	}
	return nil
}

func (s *GrafanaPluginAuthStore) RevokeRefreshToken(ctx context.Context, requestID string) error {
	s.refreshTokenRequestIDsMutex.Lock()
	defer s.refreshTokenRequestIDsMutex.Unlock()

	if signature, exists := s.RefreshTokenRequestIDs[requestID]; exists {
		rel, ok := s.RefreshTokens[signature]
		if !ok {
			return fosite.ErrNotFound
		}
		rel.active = false
		s.RefreshTokens[signature] = rel
	}
	return nil
}

func (s *GrafanaPluginAuthStore) RevokeRefreshTokenMaybeGracePeriod(ctx context.Context, requestID string, signature string) error {
	// no configuration option is available; grace period is not available with memory store
	return s.RevokeRefreshToken(ctx, requestID)
}

func (s *GrafanaPluginAuthStore) RevokeAccessToken(ctx context.Context, requestID string) error {
	s.accessTokenRequestIDsMutex.RLock()
	defer s.accessTokenRequestIDsMutex.RUnlock()

	if signature, exists := s.AccessTokenRequestIDs[requestID]; exists {
		if err := s.DeleteAccessTokenSession(ctx, signature); err != nil {
			return err
		}
	}
	return nil
}

func (s *GrafanaPluginAuthStore) GetPublicKey(ctx context.Context, issuer string, subject string, keyId string) (*jose.JSONWebKey, error) {
	s.issuerPublicKeysMutex.RLock()
	defer s.issuerPublicKeysMutex.RUnlock()

	if issuerKeys, ok := s.IssuerPublicKeys[issuer]; ok {
		if keyScopes, ok := issuerKeys.Keys[keyId]; ok {
			return keyScopes.Key, nil
		}
	}

	return nil, fosite.ErrNotFound
}
func (s *GrafanaPluginAuthStore) GetPublicKeys(ctx context.Context, issuer string, subject string) (*jose.JSONWebKeySet, error) {
	s.issuerPublicKeysMutex.RLock()
	defer s.issuerPublicKeysMutex.RUnlock()

	if issuerKeys, ok := s.IssuerPublicKeys[issuer]; ok {
		if len(issuerKeys.Keys) == 0 {
			return nil, fosite.ErrNotFound
		}

		keys := make([]jose.JSONWebKey, 0, len(issuerKeys.Keys))
		for _, keyScopes := range issuerKeys.Keys {
			keys = append(keys, *keyScopes.Key)
		}

		return &jose.JSONWebKeySet{Keys: keys}, nil
	}

	return nil, fosite.ErrNotFound
}

func (s *GrafanaPluginAuthStore) GetPublicKeyScopes(ctx context.Context, issuer string, subject string, keyId string) ([]string, error) {
	s.issuerPublicKeysMutex.RLock()
	defer s.issuerPublicKeysMutex.RUnlock()

	if issuerKeys, ok := s.IssuerPublicKeys[issuer]; ok {
		if keyScopes, ok := issuerKeys.Keys[keyId]; ok {
			return keyScopes.Scopes, nil
		}
	}

	return nil, fosite.ErrNotFound
}

func (s *GrafanaPluginAuthStore) IsJWTUsed(ctx context.Context, jti string) (bool, error) {
	err := s.ClientAssertionJWTValid(ctx, jti)
	if err != nil {
		return true, nil
	}

	return false, nil
}

func (s *GrafanaPluginAuthStore) MarkJWTUsedForTime(ctx context.Context, jti string, exp time.Time) error {
	return s.SetClientAssertionJWT(ctx, jti, exp)
}

// CreatePARSession stores the pushed authorization request context. The requestURI is used to derive the key.
func (s *GrafanaPluginAuthStore) CreatePARSession(ctx context.Context, requestURI string, request fosite.AuthorizeRequester) error {
	s.parSessionsMutex.Lock()
	defer s.parSessionsMutex.Unlock()

	s.PARSessions[requestURI] = request
	return nil
}

// GetPARSession gets the push authorization request context. If the request is nil, a new request object
// is created. Otherwise, the same object is updated.
func (s *GrafanaPluginAuthStore) GetPARSession(ctx context.Context, requestURI string) (fosite.AuthorizeRequester, error) {
	s.parSessionsMutex.RLock()
	defer s.parSessionsMutex.RUnlock()

	r, ok := s.PARSessions[requestURI]
	if !ok {
		return nil, fosite.ErrNotFound
	}

	return r, nil
}

// DeletePARSession deletes the context.
func (s *GrafanaPluginAuthStore) DeletePARSession(ctx context.Context, requestURI string) (err error) {
	s.parSessionsMutex.Lock()
	defer s.parSessionsMutex.Unlock()

	delete(s.PARSessions, requestURI)
	return nil
}
