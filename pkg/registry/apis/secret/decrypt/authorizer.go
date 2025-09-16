package decrypt

import (
	"context"
	"strings"

	"github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// decryptAuthorizer is the authorizer implementation for decrypt operations.
type decryptAuthorizer struct {
	tracer trace.Tracer
}

func ProvideDecryptAuthorizer(tracer trace.Tracer) contracts.DecryptAuthorizer {
	return &decryptAuthorizer{
		tracer: tracer,
	}
}

// authorize checks whether the auth info token has the right permissions to decrypt the secure value.
func (a *decryptAuthorizer) Authorize(ctx context.Context, ns xkube.Namespace, secureValueName string, secureValueDecrypters []string) (id string, isAllowed bool) {
	ctx, span := a.tracer.Start(ctx, "DecryptAuthorizer.Authorize", trace.WithAttributes(
		attribute.String("name", secureValueName),
		attribute.StringSlice("decrypters", secureValueDecrypters),
	))
	defer span.End()

	defer func() {
		if id != "" {
			span.SetAttributes(attribute.String("serviceIdentity", id))
		}
		span.SetAttributes(attribute.Bool("allowed", isAllowed))
	}()

	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return "", false
	}

	if !claims.NamespaceMatches(authInfo.GetNamespace(), ns.String()) {
		return "", false
	}

	serviceIdentityList, ok := authInfo.GetExtra()[authn.ServiceIdentityKey]
	if !ok {
		return "", false
	}

	// If there's more than one service identity, something is suspicious and we reject it.
	if len(serviceIdentityList) != 1 {
		return "", false
	}

	serviceIdentity := strings.TrimSpace(serviceIdentityList[0])
	if len(serviceIdentity) == 0 {
		return "", false
	}

	// Checks whether the token has the permission to decrypt secure values.
	if !hasPermissionInToken(authInfo.GetTokenPermissions(), secureValueName) {
		return serviceIdentity, false
	}

	// Finally check whether the service identity is allowed to decrypt this secure value.
	allowed := false
	for _, decrypter := range secureValueDecrypters {
		if decrypter == serviceIdentity {
			allowed = true
			break
		}
	}

	return serviceIdentity, allowed
}

// Adapted from https://github.com/grafana/authlib/blob/1492b99410603ca15730a1805a9220ce48232bc3/authz/client.go#L138
// Changes: 1) we don't support `*` for verbs; 2) we support specific names in the permission.
func hasPermissionInToken(tokenPermissions []string, name string) bool {
	var (
		group    = secretv1beta1.APIGroup
		resource = secretv1beta1.SecureValuesResourceInfo.GetName()
		verb     = "decrypt"
	)

	for _, p := range tokenPermissions {
		tokenGR, tokenVerb, found := strings.Cut(p, ":")
		if !found || tokenVerb != verb {
			continue
		}

		parts := strings.SplitN(tokenGR, "/", 3)

		switch len(parts) {
		// secret.grafana.app/securevalues:decrypt
		case 2:
			if parts[0] == group && parts[1] == resource {
				return true
			}

		// secret.grafana.app/securevalues/<name>:decrypt
		case 3:
			if parts[0] == group && parts[1] == resource && parts[2] == name && name != "" {
				return true
			}
		}
	}

	return false
}
