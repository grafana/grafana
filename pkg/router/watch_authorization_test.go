package router

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestRouterRestrictsWatchesBeforeDispatch(t *testing.T) {
	featuremgmt.WithEnabledFlags(t, featuremgmt.FlagGrafanaRestrictWatchToServiceIdentities)
	for _, typ := range []types.IdentityType{types.TypeUser, types.TypeServiceAccount, types.TypeAccessPolicy} {
		for _, group := range []string{"example", "unknown"} {
			for _, query := range []string{"?watch=true", "?watch=1&sendInitialEvents=true", ""} {
				t.Run(string(typ)+"/"+group+query, func(t *testing.T) {
					router := NewGrafanaRouter(stubLoader{}, nil)
					served := 0
					handler := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
						served++
						w.WriteHeader(http.StatusNoContent)
					})
					snapshot := map[string]servingEntry{"example": {handler: handler, breaker: newGroupBreaker("example")}}
					router.snapshot.Store(&snapshot)
					router.unregisteredGroupHandler = handler
					req := httptest.NewRequest(http.MethodGet, "/apis/"+group+"/v1/namespaces/stacks-1/widgets"+query, nil)
					req = req.WithContext(identity.WithRequester(req.Context(), &identity.StaticRequester{Type: typ, Namespace: "stacks-1"}))
					rec := httptest.NewRecorder()
					router.HandleFunc(rec, req)
					if typ == types.TypeUser && query != "" {
						require.Equal(t, http.StatusForbidden, rec.Code)
						require.Zero(t, served)
						var status metav1.Status
						require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &status))
						require.Equal(t, metav1.StatusReasonForbidden, status.Reason)
					} else {
						require.Equal(t, http.StatusNoContent, rec.Code)
						require.Equal(t, 1, served)
					}
				})
			}
		}
	}
}
