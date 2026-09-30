package kindstore

import (
	"context"

	authnlib "github.com/grafana/authlib/authn"
	claims "github.com/grafana/authlib/types"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/trace"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/util"
)

// idTokenPresentAttribute records, on the span already covering the outgoing v3
// RPC, whether that request carries the caller's identity. False means the
// plugin acted as itself for this request, not as the caller.
const idTokenPresentAttribute = "grafana.plugin.id_token_present"

// WithCallerIDToken attaches the caller's Grafana ID token to ctx (see
// k8s.ContextWithIDToken), so a v3 plugin RPC's BuildKubeConfig client acts as the
// caller, not as the plugin's own service identity. Embedded Grafana already
// has one on the requester (the edge mints it); the standalone router does
// not, so deriver mints one from the requester's OBO access token instead.
//
// A nil deriver, a missing requester, or a non-user/non-service-account
// identity leaves the token empty -- BuildKubeConfig then falls back to
// acting as the plugin, which is only correct when there genuinely is no
// caller to scope to. That fallback is logged and recorded on the span so it
// is visible when a caller's request unexpectedly ends up running as the
// plugin.
func WithCallerIDToken(ctx context.Context, deriver authnlib.IDTokenDeriver) context.Context {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return ctx
	}

	token := requester.GetIDToken()
	if token == "" {
		token = deriveIDToken(ctx, deriver, requester)
	}

	trace.SpanFromContext(ctx).SetAttributes(attribute.Bool(idTokenPresentAttribute, token != ""))
	if token == "" {
		logging.FromContext(ctx).Debug("no id token for outgoing plugin request; plugin will act as itself",
			"subject", requester.GetSubject(), "identity_type", requester.GetIdentityType())
	}

	return k8s.ContextWithIDToken(ctx, token)
}

func deriveIDToken(ctx context.Context, deriver authnlib.IDTokenDeriver, requester identity.Requester) string {
	if util.IsInterfaceNil(deriver) {
		return ""
	}
	if !requester.IsIdentityType(claims.TypeUser, claims.TypeServiceAccount) {
		return ""
	}
	accessToken := requester.GetAccessToken()
	if accessToken == "" {
		return ""
	}

	resp, err := deriver.DeriveIDToken(ctx, accessToken, requester.GetNamespace())
	if err != nil {
		logging.FromContext(ctx).Warn("failed to derive id token from access token", "error", err)
		return ""
	}
	return resp.Token
}
