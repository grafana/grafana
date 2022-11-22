package jwt

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"encoding/base64"
	"encoding/json"
	"errors"
	"time"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/secrets/kvstore"
	"github.com/grafana/grafana/pkg/setting"
	jose "gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

const (
	JWT_PLUGIN_KV_STORE_NAMESPACE = "grafana-auth-jwt-plugin"
	JWT_PLUGIN_KV_STORE_TYPE      = "private-jwk"
)

func ProvidePluginAuthService(cfg *setting.Cfg, features *featuremgmt.FeatureManager, secretsKvStore kvstore.SecretsKVStore) (*PluginAuthService, error) {
	s := newPluginAuthService(cfg, features, secretsKvStore)
	if err := s.init(); err != nil {
		return nil, err
	}

	return s, nil
}

func newPluginAuthService(cfg *setting.Cfg, features *featuremgmt.FeatureManager, secretsKvStore kvstore.SecretsKVStore) *PluginAuthService {
	return &PluginAuthService{
		Cfg:      cfg,
		Features: features,
		log:      log.New("auth.jwt.plugin"),

		// TODO: make this configurable after alpha
		jwtExpiration: 1 * time.Minute,

		secretsKVStore: kvstore.With(secretsKvStore, accesscontrol.GlobalOrgID, JWT_PLUGIN_KV_STORE_NAMESPACE, JWT_PLUGIN_KV_STORE_TYPE),
	}
}

type PluginAuthService struct {
	Cfg      *setting.Cfg
	Features *featuremgmt.FeatureManager

	log    log.Logger
	keySet keySet

	signer        jose.Signer
	jwtExpiration time.Duration

	secretsKVStore *kvstore.FixedKVStore
}

func (s *PluginAuthService) Verify(ctx context.Context, token string) (models.JWTClaims, error) {
	if !s.Features.IsEnabled(featuremgmt.FlagJwtTokenGeneration) {
		return make(models.JWTClaims), errors.New("JWT token generation is disabled")
	}

	expectedClaims := jwt.Expected{
		Issuer: s.Cfg.AppURL,
		Time:   time.Now(),
	}

	additionalClaims := make(models.JWTClaims)

	return Verify(ctx, s.keySet, expectedClaims, additionalClaims, token)
}

func (s *PluginAuthService) Generate(subject, audience string) (string, error) {
	if !s.Features.IsEnabled(featuremgmt.FlagJwtTokenGeneration) {
		return "", errors.New("JWT token generation is disabled")
	}

	claims := jwt.Claims{
		Subject:   subject,
		Issuer:    s.Cfg.AppURL,
		Audience:  jwt.Audience{audience},
		NotBefore: jwt.NewNumericDate(time.Now()),
		Expiry:    jwt.NewNumericDate(time.Now().Add(s.jwtExpiration)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}

	return jwt.Signed(s.signer).Claims(claims).CompactSerialize()
}

func (s *PluginAuthService) init() error {
	set := jose.JSONWebKeySet{}
	privKey, err := s.getPrivateKey(context.Background())
	if err != nil {
		return err
	}
	pubKey := privKey.Public()
	pubKey.KeyID = privKey.KeyID
	set.Keys = append(set.Keys, pubKey)
	s.keySet = keySetJWKS{set}

	signer, err := jose.NewSigner(jose.SigningKey{Algorithm: jose.SignatureAlgorithm(privKey.Algorithm), Key: privKey}, (&jose.SignerOptions{}).WithType("JWT"))
	if err != nil {
		return err
	}
	s.signer = signer

	return nil
}

func (s *PluginAuthService) getPrivateKey(ctx context.Context) (privKey *jose.JSONWebKey, err error) {
	raw, ok, err := s.secretsKVStore.Get(ctx)
	if err != nil {
		return nil, err
	}

	if ok {
		if err = json.Unmarshal([]byte(raw), privKey); err != nil {
			s.log.Debug("Failed to unmarshal private key from KV store", "err", err)
		}
	}

	if privKey == nil {
		if privKey, err = generateJWK(); err != nil {
			return nil, err
		}
		keyJson, err := json.Marshal(privKey)
		if err != nil {
			return nil, err
		}
		if err = s.secretsKVStore.Set(ctx, string(keyJson)); err != nil {
			return nil, err
		}
	}

	return privKey, nil
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
