package pluginsettings

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/apps/secret/pkg/decrypt"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

// DecryptedSecureJSONLoader returns the decrypted secure values for a resource
// once preceding access checks have passed. Construction validates inputs;
// the returned function performs the actual decryption on demand.
type DecryptedSecureJSONLoader func(context.Context) (map[string]string, error)

// EmptyDecryptedSecureJSONLoader is a loader that returns no secure values.
// Use it when a resource is known to have nothing to decrypt.
func EmptyDecryptedSecureJSONLoader(context.Context) (map[string]string, error) {
	return map[string]string{}, nil
}

type ctxKey struct{}

type secureContextShim struct {
	loader DecryptedSecureJSONLoader
}

// WithSecureContextShim must wrap a context before any request that may stash
// already-decrypted values via WithDecryptedValues. Without the shim,
// WithDecryptedValues is a no-op and GetDecryptedSecureJSONLoader falls through
// to the decrypter.
func WithSecureContextShim(ctx context.Context) context.Context {
	return context.WithValue(ctx, ctxKey{}, &secureContextShim{})
}

// WithDecryptedValues stashes already-decrypted secure values on the context
// shim so a later GetDecryptedSecureJSONLoader call returns them directly
// without re-decrypting. No-op if WithSecureContextShim was not called.
func WithDecryptedValues(ctx context.Context, loader DecryptedSecureJSONLoader) {
	if shim, ok := ctx.Value(ctxKey{}).(*secureContextShim); ok {
		shim.loader = loader
	}
}

// GetDecryptedSecureJSONLoader returns a loader for the decrypted secure values
// of obj. If WithDecryptedValues populated the same context, those values are
// reused; otherwise the loader calls decrypter on demand.
func GetDecryptedSecureJSONLoader(ctx context.Context, obj utils.GrafanaMetaAccessor, decrypter decrypt.DecryptService) (DecryptedSecureJSONLoader, error) {
	if shim, ok := ctx.Value(ctxKey{}).(*secureContextShim); ok && shim.loader != nil {
		return shim.loader, nil
	}

	secure, err := obj.GetSecureValues()
	if err != nil {
		return nil, err
	}
	if len(secure) == 0 {
		return EmptyDecryptedSecureJSONLoader, nil
	}
	if decrypter == nil {
		return nil, errors.New("no decrypter configured")
	}

	// Validate and collect names up front so config errors surface here rather
	// than on the first decrypt call.
	names := make([]string, 0, len(secure))
	for k, ref := range secure {
		if ref.Name == "" {
			return nil, fmt.Errorf("missing secure value name for key: %s", k)
		}
		names = append(names, ref.Name)
	}

	group := obj.GetGroupVersionKind().Group
	namespace := obj.GetNamespace()
	return func(ctx context.Context) (map[string]string, error) {
		lookup, err := decrypter.Decrypt(ctx, group, namespace, names...)
		if err != nil {
			return nil, fmt.Errorf("error decrypting secure values: %w", err)
		}

		decrypted := make(map[string]string, len(secure))
		for k, ref := range secure {
			res, ok := lookup[ref.Name]
			if !ok {
				return nil, fmt.Errorf("unable to find secure value: %s for key: %s", ref.Name, k)
			}
			if err := res.Error(); err != nil {
				return nil, fmt.Errorf("error decrypting secure value: %s / %w", k, err)
			}
			if val := res.Value(); val != nil {
				decrypted[k] = val.DangerouslyExposeAndConsumeValue()
			}
		}
		return decrypted, nil
	}, nil
}
