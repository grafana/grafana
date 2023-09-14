package idsignerimpl

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-jose/go-jose/v3"
	"github.com/go-jose/go-jose/v3/jwt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/network"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/signingkeys"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/web"
)

var _ auth.IDSignerService = new(Service)

const cacheKeyPrefix = "assertid"

type TokenSigner interface {
	GetJWK() jose.JSONWebKey
	SignToken(claims *jwt.Claims, assertions *auth.IDAssertions) (string, error)
}

// Service implements the auth.IDSingerService
type Service struct {
	Signer            TokenSigner
	logger            log.Logger
	remoteCache       remotecache.CacheStorage
	signingKeyService signingkeys.Service
	cfg               *setting.Cfg
	teams             team.Service
}

// ProvideIDSigningService returns a new instance of the auth.IDSignerService.
func ProvideIDSigningService(
	remoteCache remotecache.CacheStorage, cfg *setting.Cfg,
	signingKeyService signingkeys.Service, teams team.Service,
) (*Service, error) {
	service := &Service{
		logger:            log.New("auth.assertid"),
		remoteCache:       remoteCache,
		cfg:               cfg,
		signingKeyService: signingKeyService,
		teams:             teams,
		Signer:            nil,
	}

	signer, err := newLocalSigner(signingKeyService)
	if err != nil {
		return nil, err

	}
	service.Signer = signer

	return service, nil
}

func (s *Service) SignIdentity(ctx context.Context, id identity.Requester, req *http.Request) (string, error) {
	if s.Signer == nil {
		return "", fmt.Errorf("signer unavailable")
	}

	cacheKey := prefixChacheKey(id.GetCacheKey())
	val, err := s.remoteCache.Get(ctx, cacheKey)
	if err == nil {
		return string(val), nil
	}

	namespace, identifier := id.GetNamespacedID()
	// Set the JWT claims.
	claims := &jwt.Claims{
		Issuer:   s.cfg.AppURL,
		Audience: jwt.Audience{strconv.FormatInt(id.GetOrgID(), 10)},
		Subject:  fmt.Sprintf("%s:%s", namespace, identifier),
		Expiry:   jwt.NewNumericDate(time.Now().Add(time.Minute * 5)),
		IssuedAt: jwt.NewNumericDate(time.Now()),
		ID:       identifier,
	}

	assertions, err := s.generateUserAssertion(ctx, id, req)
	if err != nil {
		return "", err
	}

	// sign the claims and assetion
	token, err := s.Signer.SignToken(claims, assertions)
	if err != nil {
		return "", err
	}

	if err := s.remoteCache.Set(ctx, cacheKey, []byte(token), time.Minute*4); err != nil {
		s.logger.Error("failed to set cache", "error", err)
	}

	return token, nil
}

func (s *Service) generateUserAssertion(ctx context.Context, id identity.Requester, req *http.Request) (*auth.IDAssertions, error) {
	idAssertions := &auth.IDAssertions{
		IPAddress: getIPString(req),
		Teams:     []string{},
	}

	namespace, identifier := id.GetNamespacedID()
	if namespace == identity.NamespaceUser {
		userID, err := identity.IntIdentifier(namespace, identifier)
		if err != nil {
			return nil, err
		}

		// Get the user's teams.
		query := team.GetTeamsByUserQuery{OrgID: id.GetOrgID(), UserID: userID, SignedInUser: id}
		teams, err := s.teams.GetTeamsByUser(ctx, &query)
		if err != nil {
			return nil, err
		}

		for _, t := range teams {
			idAssertions.Teams = append(idAssertions.Teams, t.Name)
		}
	}

	return idAssertions, nil
}

func getIPString(req *http.Request) string {
	ip, _ := network.GetIPFromAddress(web.RemoteAddr(req))
	if len(ip) == 0 {
		return ""
	}

	return ip.String()
}

func prefixChacheKey(key string) string {
	return fmt.Sprintf("%s-%s", cacheKeyPrefix, key)
}
