package decrypt

import (
	"context"
	"strings"

	claims "github.com/grafana/authlib/types"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// decryptAuthorizer is the authorizer implementation for decrypt operations.
type decryptAuthorizer struct {
	allowList contracts.DecryptAllowList
}

func ProvideDecryptAuthorizer(allowList contracts.DecryptAllowList) contracts.DecryptAuthorizer {
	return &decryptAuthorizer{
		allowList: allowList,
	}
}

// authorize checks whether the auth info token has the right permissions to decrypt the secure value.
func (a *decryptAuthorizer) Authorize(ctx context.Context, secureValueDecrypters []string) (string, bool) {
	authInfo, ok := claims.AuthInfoFrom(ctx)
	if !ok {
		return "", false
	}

	tokenPermissions := authInfo.GetTokenPermissions()

	tokenActors := make(map[string]struct{}, 0)
	for _, permission := range tokenPermissions {
		// Will look like `secret.grafana.app/securevalues/<actor>:decrypt` for now.
		gr, verb, found := strings.Cut(permission, ":")
		if !found {
			continue
		}

		// If it isn't decrypt, then we don't care to check.
		if verb != "decrypt" {
			continue
		}

		parts := strings.Split(gr, "/")
		if len(parts) != 3 {
			continue
		}

		group, resource, actor := parts[0], parts[1], parts[2]
		if group != secretv0alpha1.GROUP || resource != secretv0alpha1.SecureValuesResourceInfo.GetName() || actor == "" {
			continue
		}

		// TEMPORARY: while we can't onboard every app into secrets, we can block them from decrypting
		// securevalues preemptively here before even reaching out to the database.
		// This check can be removed once we open the gates for any service to use secrets.
		if _, exists := a.allowList[actor]; !exists {
			continue
		}

		tokenActors[actor] = struct{}{}
	}

	// If we arrived here and the token actors is empty, it means the permissions either have an invalid format,
	// or it didn't pass the allow list, meaning no allowed decryptor.
	if len(tokenActors) == 0 {
		return "", false
	}

	// TEMPORARY: while we still need to mix permission and identity, we can use this
	// to decide whether the SecureValue can be decrypted or not.
	// Once we have an `actor` field in the JWT claims, we can have a properly formatted permission,
	// like `secret.grafana.app/securevalues{/<name>}:decrypt` and do regular access control eval,
	// and for the `decrypters` part here, we can just check it against the `actor` field, which at
	// that point will have a different format, depending on how the `actor` will be formatted.
	// Check whether at least one of declared token actors matches the allowed decrypters from the SecureValue.
	allowed := false

	var identity string
	for _, decrypter := range secureValueDecrypters {
		if _, exists := tokenActors[decrypter]; exists {
			allowed = true
			identity = decrypter
			break
		}
	}

	return identity, allowed
}
