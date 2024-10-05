package secret

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/generic"
	"k8s.io/apiserver/pkg/registry/rest"

	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type EncryptedValue struct {
	Provider secret.KeyManagementProvider // the provider used to encrypt
	KID      string                       // The key ID.  Used to identify which key encrypted the value
	Salt     string                       // random short string (never exposed externally)
	Value    string                       // The encrypted value
}

type SecretManager interface {
	GetKeeper(ctx context.Context, namespace string, name string) (SecretKeeper, error)
	InitStorage(scheme *runtime.Scheme, storage map[string]rest.Storage, optsGetter generic.RESTOptionsGetter) error
}

type SecretKeeper interface {
	Encrypt(ctx context.Context, value string) (EncryptedValue, error)
	Decrypt(ctx context.Context, value EncryptedValue) (string, error)

	// The set of keys we can still use to decrypt, but are not using for encryption
	RetiredKeyIDs(ctx context.Context) ([]string, error)

	// Get a remote value from a path
	ReadValue(ctx context.Context, path string) (string, error)
}

func ProvideSecretManager(cfg *setting.Cfg) (SecretManager, error) {
	// TODO... read config and actually use key
	return &simpleManager{
		keeper: &simpleKeeper{},
	}, nil
}

var (
	_ SecretManager = (*simpleManager)(nil)
)

type simpleManager struct {
	keeper SecretKeeper
}

// GetKeeper implements SecretManager.
func (s *simpleManager) GetKeeper(ctx context.Context, namespace string, name string) (SecretKeeper, error) {
	if name == "" || name == "default" {
		return s.keeper, nil
	}
	return nil, fmt.Errorf("custom stores are not supported")
}

func (s *simpleManager) InitStorage(scheme *runtime.Scheme, storage map[string]rest.Storage, optsGetter generic.RESTOptionsGetter) error {
	return nil
}

type simpleKeeper struct{}

// Encode implements SecretKeeper.
func (s *simpleKeeper) Encrypt(ctx context.Context, value string) (EncryptedValue, error) {
	salt, err := util.GetRandomString(10)
	if err != nil {
		return EncryptedValue{}, err
	}
	return EncryptedValue{
		KID:   "base64",
		Salt:  salt,
		Value: base64.StdEncoding.EncodeToString([]byte(salt + value)),
	}, nil
}

// Decode implements SecretKeeper.
func (s *simpleKeeper) Decrypt(ctx context.Context, value EncryptedValue) (string, error) {
	if value.KID != "base64" {
		return "", fmt.Errorf("unsupported key")
	}

	out, err := base64.StdEncoding.DecodeString(value.Value)
	if err != nil {
		return "", err
	}
	f, ok := strings.CutPrefix(string(out), value.Salt)
	if !ok {
		return "", fmt.Errorf("salt not found in value")
	}
	return f, nil
}

func (s *simpleKeeper) RetiredKeyIDs(ctx context.Context) ([]string, error) {
	return []string{}, nil
}

func (s *simpleKeeper) ReadValue(ctx context.Context, path string) (string, error) {
	return "", fmt.Errorf("unsupported operation")
}
