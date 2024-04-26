package api

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/go-openapi/strfmt"

	alertingNotify "github.com/grafana/alerting/notify"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	authz "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/util"
)

func (srv AlertmanagerSrv) RouteGetSilence(c *contextmodel.ReqContext, silenceID string) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	gettableSilence, err := am.GetSilence(c.Req.Context(), silenceID)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, gettableSilence)
}

func (srv AlertmanagerSrv) RouteGetSilences(c *contextmodel.ReqContext) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	gettableSilences, err := am.ListSilences(c.Req.Context(), c.QueryStrings("filter"))
	if err != nil {
		if errors.Is(err, alertingNotify.ErrListSilencesBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, gettableSilences)
}

func (srv AlertmanagerSrv) RouteCreateSilence(c *contextmodel.ReqContext, postableSilence apimodels.PostableSilence) response.Response {
	err := postableSilence.Validate(strfmt.Default)
	if err != nil {
		srv.log.Error("Silence failed validation", "error", err)
		return ErrResp(http.StatusBadRequest, err, "silence failed validation")
	}

	action := accesscontrol.ActionAlertingInstanceUpdate
	if postableSilence.ID == "" {
		action = accesscontrol.ActionAlertingInstanceCreate
	}
	evaluator := accesscontrol.EvalPermission(action)
	if !accesscontrol.HasAccess(srv.ac, c)(evaluator) {
		errAction := "update"
		if postableSilence.ID == "" {
			errAction = "create"
		}
		return response.Err(authz.NewAuthorizationErrorWithPermissions(fmt.Sprintf("%s silences", errAction), evaluator))
	}

	silenceID, err := srv.mam.CreateSilence(c.Req.Context(), c.SignedInUser.GetOrgID(), &postableSilence)
	if err != nil {
		if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		if errors.Is(err, notifier.ErrAlertmanagerNotReady) {
			return ErrResp(http.StatusConflict, err, "")
		}

		if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}

		if errors.Is(err, alertingNotify.ErrCreateSilenceBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}

		return ErrResp(http.StatusInternalServerError, err, "failed to create silence")
	}
	return response.JSON(http.StatusAccepted, apimodels.PostSilencesOKBody{
		SilenceID: silenceID,
	})
}

func (srv AlertmanagerSrv) RouteDeleteSilence(c *contextmodel.ReqContext, silenceID string) response.Response {
	if err := srv.mam.DeleteSilence(c.Req.Context(), c.SignedInUser.GetOrgID(), silenceID); err != nil {
		if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		if errors.Is(err, notifier.ErrAlertmanagerNotReady) {
			return ErrResp(http.StatusConflict, err, "")
		}
		if errors.Is(err, alertingNotify.ErrSilenceNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "silence deleted"})
}
