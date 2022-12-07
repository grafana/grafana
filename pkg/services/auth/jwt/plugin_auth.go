package jwt

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"errors"
	"fmt"
	"os"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	jose "gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

const (
	JWT_PLUGIN_KV_STORE_NAMESPACE = "grafana-auth-jwt-plugin"
	JWT_PLUGIN_KV_STORE_TYPE      = "private-jwk"
)

func ProvidePluginAuthService(cfg *setting.Cfg, features *featuremgmt.FeatureManager, secretsKvStore kvstore.SecretsKVStore) (PluginAuthService, error) {
	s := newPluginAuthService(cfg, features, secretsKvStore)
	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newPluginAuthService(cfg *setting.Cfg, features *featuremgmt.FeatureManager, secretsKvStore kvstore.SecretsKVStore) *pluginAuthService {
	return &pluginAuthService{
		Cfg:      cfg,
		Features: features,
		log:      log.New("auth.jwt.plugin"),

		// TODO: make this configurable after alpha
		jwtExpiration: 1 * time.Minute,

		secretsKVStore: kvstore.With(secretsKvStore, accesscontrol.GlobalOrgID, JWT_PLUGIN_KV_STORE_NAMESPACE, JWT_PLUGIN_KV_STORE_TYPE),
	}
}

type PluginAuthService interface {
	Verify(context.Context, string) (models.JWTClaims, error)
	Generate(*user.SignedInUser, string) (string, error)
	IsEnabled() bool
	UnaryClientInterceptor(string) grpc.UnaryClientInterceptor
	StreamClientInterceptor(string) grpc.StreamClientInterceptor
}

type pluginAuthService struct {
	Cfg      *setting.Cfg
	Features *featuremgmt.FeatureManager

	log    log.Logger
	keySet keySet

	signer        jose.Signer
	jwtExpiration time.Duration

	secretsKVStore *kvstore.FixedKVStore
}

func (s *pluginAuthService) IsEnabled() bool {
	return s.Features.IsEnabled(featuremgmt.FlagJwtTokenGeneration)
}

func (s *pluginAuthService) Verify(ctx context.Context, token string) (models.JWTClaims, error) {
	if !s.IsEnabled() {
		return make(models.JWTClaims), errors.New("JWT token generation is disabled")
	}

	expectedClaims := jwt.Expected{
		Issuer: s.Cfg.AppURL,
		Time:   time.Now(),
	}

	additionalClaims := make(models.JWTClaims)

	return Verify(ctx, s.keySet, expectedClaims, additionalClaims, token)
}

func (s *pluginAuthService) Generate(usr *user.SignedInUser, audience string) (string, error) {
	if !s.IsEnabled() {
		return "", errors.New("JWT token generation is disabled")
	}

	tenantID, err := strconv.ParseInt(os.Getenv("stackID"), 10, 64)
	if err != nil {
		fmt.Println("WARNING stackID is missing:", err)
	}

	claims := jwt.Claims{
		Subject:   strconv.FormatInt(usr.UserID, 10),
		Issuer:    s.Cfg.AppURL,
		Audience:  jwt.Audience{audience},
		NotBefore: jwt.NewNumericDate(time.Now()),
		Expiry:    jwt.NewNumericDate(time.Now().Add(s.jwtExpiration)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}

	customClaims := struct {
		orgID       int64
		tenantID    int64
		login       string
		displayName string
	}{
		orgID:       usr.OrgID,
		tenantID:    tenantID,
		login:       usr.Login,
		displayName: usr.Name,
	}

	t, err := jwt.Signed(s.signer).Claims(claims).Claims(customClaims).CompactSerialize()
	return t, err
}

func (s *pluginAuthService) init() error {
	set := jose.JSONWebKeySet{}
	privKey, err := s.getPrivateKey(context.Background())
	if err != nil {
		return err
	}
	pubKey := privKey.Public()
	set.Keys = append(set.Keys, pubKey)
	s.keySet = keySetJWKS{set}

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.SignatureAlgorithm(privKey.Algorithm), Key: privKey}, (&jose.SignerOptions{}).WithType("JWT"))
	if err != nil {
		return err
	}
	s.signer = signer

	return nil
}

func (s *pluginAuthService) getPrivateKey(ctx context.Context) (*jose.JSONWebKey, error) {
	var privKey = &jose.JSONWebKey{}
	raw, ok, err := s.secretsKVStore.Get(ctx)
	if err != nil {
		return nil, err
	}

	if ok {
		if err = privKey.UnmarshalJSON([]byte(raw)); err != nil {
			return nil, err
		}
		return privKey, nil
	}

	if privKey, err = generateJWK(); err != nil {
		return nil, err
	}
	keyJson, err := privKey.MarshalJSON()
	if err != nil {
		return nil, err
	}
	if err = s.secretsKVStore.Set(ctx, string(keyJson)); err != nil {
		return nil, err
	}

	return privKey, nil
}

func (s *pluginAuthService) UnaryClientInterceptor(namespace string) grpc.UnaryClientInterceptor {
	return func(ctx context.Context, method string, req, reply interface{}, cc *grpc.ClientConn, invoker grpc.UnaryInvoker, opts ...grpc.CallOption) error {
		if !s.IsEnabled() {
			return invoker(ctx, method, req, reply, cc, opts...)
		}

		usr, err := appcontext.User(ctx)
		if err != nil {
			s.log.Error("Failed to get user from context", "err", err)
			return invoker(ctx, method, req, reply, cc, opts...)
		}

		token, err := s.Generate(usr, namespace)
		if err != nil {
			return err
		}

		ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		return invoker(ctx, method, req, reply, cc, opts...)
	}
}

func (s *pluginAuthService) StreamClientInterceptor(namespace string) grpc.StreamClientInterceptor {
	return func(ctx context.Context, desc *grpc.StreamDesc, cc *grpc.ClientConn, method string, streamer grpc.Streamer, opts ...grpc.CallOption) (grpc.ClientStream, error) {
		if !s.IsEnabled() {
			return streamer(ctx, desc, cc, method, opts...)
		}

		usr, err := appcontext.User(ctx)
		if err != nil {
			s.log.Error("Failed to get user from context", "err", err)
			return streamer(ctx, desc, cc, method, opts...)
		}

		token, err := s.Generate(usr, namespace)
		if err != nil {
			return nil, err
		}

		ctx = metadata.AppendToOutgoingContext(ctx, "authorization", "Bearer "+token)
		return streamer(ctx, desc, cc, method, opts...)
	}
}

func generateJWK() (privKey *jose.JSONWebKey, err error) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, err
	}
	privKey = &jose.JSONWebKey{Key: key, KeyID: "", Algorithm: string(jose.RS512), Use: "sig"}
	thumb, err := privKey.Thumbprint(crypto.SHA256)
	if err != nil {
		return nil, err
	}
	privKey.KeyID = base64.RawURLEncoding.EncodeToString(thumb)
	return privKey, nil
}
