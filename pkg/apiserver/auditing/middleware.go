package auditing

import (
	"net/http"

	"github.com/grafana/authlib/types"
	"k8s.io/apiserver/pkg/audit"
)

const AuditAnnotationInnermostServiceIdentity = "grafana.app/innermost-service-identity"

// HTTPInjectAuditAnnotationMiddleware extracts the innermost service identity from the request,
// and injects it into the k8s audit event context (used for audit log suppression).
func HTTPInjectAuditAnnotationMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if authInfo, ok := types.AuthInfoFrom(r.Context()); ok {
			if innermostSvcIdentity := authInfo.GetExtra()["innermostServiceIdentity"]; len(innermostSvcIdentity) > 0 {
				// Annotate the K8s audit event so the audit backend can make a decision based on it.
				audit.AddAuditAnnotation(r.Context(), AuditAnnotationInnermostServiceIdentity, innermostSvcIdentity[0])
			}
		}

		next.ServeHTTP(w, r)
	})
}
