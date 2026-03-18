package middleware

import (
	"fmt"
	"net/http"
	"strings"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/auth"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/contexthandler"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

const userSimulationAPIPrefix = "/api/admin/user-simulation"

var userSimulationLog = log.New("user_simulation")

// UserSimulation replaces the request identity with the simulated user when the session token
// has simulate_user_id set. Grafana admin API paths under userSimulationAPIPrefix are excluded
// so admins can start/stop simulation without swapping identity.
func UserSimulation(authnService authn.Service, tokenService auth.UserTokenService) web.Handler {
	return func(_ http.ResponseWriter, r *http.Request, _ *web.Context) {
		reqCtx := contexthandler.FromContext(r.Context())
		if reqCtx == nil || !reqCtx.IsSignedIn || reqCtx.UserToken == nil {
			return
		}
		if strings.HasPrefix(r.URL.Path, userSimulationAPIPrefix) {
			return
		}

		simID := reqCtx.UserToken.SimulateUserID
		if simID <= 0 {
			return
		}

		actorLogin := reqCtx.UserToken.SimulationActorLogin
		if actorLogin == "" {
			actorLogin = "?"
		}

		orgID := reqCtx.OrgID
		typedUser := fmt.Sprintf("user:%d", simID)
		simIdent, err := authnService.ResolveIdentity(r.Context(), orgID, typedUser)
		if err != nil || simIdent == nil || simIdent.IsNil() {
			if clearErr := tokenService.ClearTokenSimulation(r.Context(), reqCtx.UserToken.Id, reqCtx.UserToken.UserId); clearErr != nil {
				userSimulationLog.Warn("Failed to clear invalid user simulation", "err", clearErr)
			}
			return
		}

		if simIdent.IsIdentityType(claims.TypeServiceAccount) {
			if clearErr := tokenService.ClearTokenSimulation(r.Context(), reqCtx.UserToken.Id, reqCtx.UserToken.UserId); clearErr != nil {
				userSimulationLog.Warn("Failed to clear service-account simulation", "err", clearErr)
			}
			return
		}

		reqCtx.UserSimulation = &contextmodel.UserSimulationInfo{
			ActorLogin:   actorLogin,
			TargetUserID: simID,
			TargetLogin:  simIdent.Login,
		}
		reqCtx.SignedInUser = simIdent.SignedInUser()
		newCtx := identity.WithRequester(r.Context(), simIdent)
		reqCtx.Req = reqCtx.Req.WithContext(newCtx)
	}
}
