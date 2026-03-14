package identity

import (
	"context"
	"net/http"

	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/audit"
)

const (
	// MetadataKeyUpstreamCaller is the gRPC metadata key / HTTP header for the upstream caller's service identity.
	// It is propagated automatically across service boundaries so that downstream services know who originated the request chain.
	// The first service to receive the request sets it using the caller's auth token serviceIdentity key.
	MetadataKeyUpstreamCaller = "x-grafana-upstream-caller-identity"

	// AuditAnnotationUpstreamCaller is the K8s audit annotation key used to record the upstream caller identity on audit events.
	// This allows audit backends to suppress events initiated by internal callers.
	AuditAnnotationUpstreamCaller = "grafana.app/upstream-caller-identity"

	// authServiceIdentityKey is the key used by authlib for the recording the service identity.
	// Duplicated to avoid importing the whole authn package.
	authServiceIdentityKey = "serviceIdentity"
)

type upstreamCallerKey struct{}

// UpstreamCallerFromContext returns the upstream caller identity from the context.
func UpstreamCallerFromContext(ctx context.Context) string {
	v, _ := ctx.Value(upstreamCallerKey{}).(string)
	return v
}

// WithUpstreamCaller stores the upstream caller identity in the context.
func WithUpstreamCaller(ctx context.Context, caller string) context.Context {
	return context.WithValue(ctx, upstreamCallerKey{}, caller)
}

// ResolveUpstreamCaller determines the upstream caller identity for a request.
// If an upstream caller is already present (from an inbound header/metadata), it is preserved.
// Otherwise, the caller's service identity is extracted from the auth info.
func ResolveUpstreamCaller(ctx context.Context, caller string) string {
	if caller != "" {
		return caller
	}

	if authInfo, ok := types.AuthInfoFrom(ctx); ok {
		if ids, ok := authInfo.GetExtra()[authServiceIdentityKey]; ok && len(ids) > 0 {
			// There should be only one, but the `Extra` method always returns a slice.
			return ids[0]
		}
	}

	// It's still optional to set the serviceIdentityKey, so we don't need to error out.
	return ""
}

// HTTPMiddleware extracts the upstream caller identity from the request header
// into the context. If the header is absent, it falls back to the authenticated
// caller's service identity from the auth info.
//
// Must be placed in the handler chain AFTER authentication so that auth info is available.
func HTTPMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if caller := ResolveUpstreamCaller(r.Context(), r.Header.Get(MetadataKeyUpstreamCaller)); caller != "" {
			ctx := WithUpstreamCaller(r.Context(), caller)

			// Annotate the K8s audit event so the audit backend can make a decision based on it.
			audit.AddAuditAnnotation(ctx, AuditAnnotationUpstreamCaller, caller)

			r = r.WithContext(ctx)
		}

		next.ServeHTTP(w, r)
	})
}
