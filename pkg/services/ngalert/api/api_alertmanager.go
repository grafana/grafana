package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	alertingNotify "github.com/grafana/alerting/notify"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

const (
	defaultTestReceiversTimeout = 15 * time.Second
	maxTestReceiversTimeout     = 30 * time.Second
)

type receiversAuthz interface {
	FilterRead(ctx context.Context, user identity.Requester, receivers ...ReceiverStatus) ([]ReceiverStatus, error)
}

type AlertmanagerSrv struct {
	log            log.Logger
	ac             accesscontrol.AccessControl
	mam            *notifier.MultiOrgAlertmanager
	crypto         notifier.Crypto
	silenceSvc     SilenceService
	featureManager featuremgmt.FeatureToggles
	receiverAuthz  receiversAuthz
}

type UnknownReceiverError struct {
	UID string
}

func (e UnknownReceiverError) Error() string {
	return fmt.Sprintf("unknown receiver: %s", e.UID)
}

func (srv AlertmanagerSrv) RouteGetAMStatus(c *contextmodel.ReqContext) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	status, err := am.GetStatus(c.Req.Context())
	if err != nil {
		srv.log.Error("Unable to get status for the alertmanager", "error", err)
		return ErrResp(http.StatusInternalServerError, err, "failed to get status for the Alertmanager")
	}

	if !c.SignedInUser.HasRole(org.RoleAdmin) {
		notifier.RemoveAutogenConfigIfExists(status.Config.Route)
	}

	return response.JSON(http.StatusOK, status)
}

func (srv AlertmanagerSrv) RouteDeleteAlertingConfig(c *contextmodel.ReqContext) response.Response {
	err := srv.mam.SaveAndApplyDefaultConfig(c.Req.Context(), c.SignedInUser.GetOrgID())
	if err != nil {
		srv.log.Error("Unable to save and apply default alertmanager configuration", "error", err)
		return response.ErrOrFallback(http.StatusInternalServerError, "failed to save and apply default Alertmanager configuration", err)
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration deleted; the default is applied"})
}

func (srv AlertmanagerSrv) RouteGetAlertingConfig(c *contextmodel.ReqContext) response.Response {
	canSeeAutogen := c.SignedInUser.HasRole(org.RoleAdmin)
	config, err := srv.mam.GetAlertmanagerConfiguration(c.Req.Context(), c.SignedInUser.GetOrgID(), canSeeAutogen)
	if err != nil {
		if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, err.Error())
	}
	return response.JSON(http.StatusOK, config)
}

func (srv AlertmanagerSrv) RouteGetAlertingConfigHistory(c *contextmodel.ReqContext) response.Response {
	limit := c.QueryInt("limit")
	configs, err := srv.mam.GetAppliedAlertmanagerConfigurations(c.Req.Context(), c.SignedInUser.GetOrgID(), limit)
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, err.Error())
	}

	return response.JSON(http.StatusOK, configs)
}

func (srv AlertmanagerSrv) RouteGetAMAlertGroups(c *contextmodel.ReqContext) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	groups, err := am.GetAlertGroups(
		c.Req.Context(),
		c.QueryBoolWithDefault("active", true),
		c.QueryBoolWithDefault("silenced", true),
		c.QueryBoolWithDefault("inhibited", true),
		c.QueryStrings("filter"),
		c.Query("receiver"),
	)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrGetAlertGroupsBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, groups)
}

func (srv AlertmanagerSrv) RouteGetAMAlerts(c *contextmodel.ReqContext) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	alerts, err := am.GetAlerts(
		c.Req.Context(),
		c.QueryBoolWithDefault("active", true),
		c.QueryBoolWithDefault("silenced", true),
		c.QueryBoolWithDefault("inhibited", true),
		c.QueryStrings("filter"),
		c.Query("receiver"),
	)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrGetAlertsBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		if errors.Is(err, alertingNotify.ErrGetAlertsUnavailable) {
			return ErrResp(http.StatusServiceUnavailable, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, alerts)
}

func (srv AlertmanagerSrv) RoutePostGrafanaAlertingConfigHistoryActivate(c *contextmodel.ReqContext, id string) response.Response {
	confId, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "failed to parse config id")
	}

	err = srv.mam.ActivateHistoricalConfiguration(c.Req.Context(), c.SignedInUser.GetOrgID(), confId)
	if err != nil {
		var unknownReceiverError notifier.UnknownReceiverError
		if errors.As(err, &unknownReceiverError) {
			return ErrResp(http.StatusBadRequest, unknownReceiverError, "")
		}
		var configRejectedError notifier.AlertmanagerConfigRejectedError
		if errors.As(err, &configRejectedError) {
			return ErrResp(http.StatusBadRequest, configRejectedError, "")
		}
		if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return response.Error(http.StatusNotFound, err.Error(), err)
		}
		if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
			return response.Error(http.StatusNotFound, err.Error(), err)
		}
		if errors.Is(err, notifier.ErrAlertmanagerNotReady) {
			return response.Error(http.StatusConflict, err.Error(), err)
		}

		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration activated"})
}

func (srv AlertmanagerSrv) RoutePostAlertingConfig(c *contextmodel.ReqContext, body apimodels.PostableUserConfig) response.Response {
	// Remove autogenerated config from the user config before checking provenance guard and eventually saving it.
	// TODO: This and provenance guard should be moved to the notifier package.
	notifier.RemoveAutogenConfigIfExists(body.AlertmanagerConfig.Route)
	currentConfig, err := srv.mam.GetAlertmanagerConfiguration(c.Req.Context(), c.SignedInUser.GetOrgID(), false)
	// If a config is present and valid we proceed with the guard, otherwise we
	// just bypass the guard which is okay as we are anyway in an invalid state.
	if err == nil {
		if err := srv.provenanceGuard(currentConfig, body); err != nil {
			return ErrResp(http.StatusBadRequest, err, "")
		}
	}
	if srv.featureManager.IsEnabled(c.Req.Context(), featuremgmt.FlagAlertingApiServer) {
		if err != nil {
			// Unclear if returning an error here is the right thing to do, preventing the user from posting a new config
			// when the current one is legitimately invalid is not optimal, but we need to ensure receiver
			// permissions are maintained and prevent potential access control bypasses. The workaround is to use the
			// various new k8s API endpoints to fix the configuration.
			return ErrResp(http.StatusInternalServerError, err, "")
		}
		if err := srv.k8sApiServiceGuard(currentConfig, body); err != nil {
			return ErrResp(http.StatusBadRequest, err, "")
		}
	}
	err = srv.mam.SaveAndApplyAlertmanagerConfiguration(c.Req.Context(), c.SignedInUser.GetOrgID(), body)
	if err == nil {
		return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration created"})
	}
	var unknownReceiverError notifier.UnknownReceiverError
	if errors.As(err, &unknownReceiverError) {
		return ErrResp(http.StatusBadRequest, unknownReceiverError, "")
	}
	var configRejectedError notifier.AlertmanagerConfigRejectedError
	if errors.As(err, &configRejectedError) {
		return ErrResp(http.StatusBadRequest, configRejectedError, "")
	}
	if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
		return response.Error(http.StatusNotFound, err.Error(), err)
	}
	if errors.Is(err, notifier.ErrAlertmanagerNotReady) {
		return response.Error(http.StatusConflict, err.Error(), err)
	}

	return response.ErrOrFallback(http.StatusInternalServerError, err.Error(), err)
}

func (srv AlertmanagerSrv) RouteGetReceivers(c *contextmodel.ReqContext) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	rcvs, err := am.GetReceivers(c.Req.Context())
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to retrieve receivers")
	}
	statuses := make([]ReceiverStatus, 0, len(rcvs))
	for _, rcv := range rcvs { // TODO this is temporary so we can use authz filter logic.
		statuses = append(statuses, ReceiverStatus(rcv))
	}
	statuses, err = srv.receiverAuthz.FilterRead(c.Req.Context(), c.SignedInUser, statuses...)
	if err != nil {
		response.ErrOrFallback(http.StatusInternalServerError, "failed to apply permissions to the receivers", err)
	}
	return response.JSON(http.StatusOK, statuses)
}

func (srv AlertmanagerSrv) RoutePostTestReceivers(c *contextmodel.ReqContext, body apimodels.TestReceiversConfigBodyParams) response.Response {
	if err := srv.crypto.ProcessSecureSettings(c.Req.Context(), c.SignedInUser.GetOrgID(), body.Receivers); err != nil {
		var unknownReceiverError UnknownReceiverError
		if errors.As(err, &unknownReceiverError) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to post process Alertmanager configuration")
	}

	ctx, cancelFunc, err := contextWithTimeoutFromRequest(
		c.Req.Context(),
		c.Req,
		defaultTestReceiversTimeout,
		maxTestReceiversTimeout)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	defer cancelFunc()

	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	result, status, err := am.TestReceivers(ctx, body)
	if err != nil {
		if errors.Is(err, alertingNotify.ErrNoReceivers) {
			return response.Error(http.StatusBadRequest, "", err)
		}
		return response.Error(http.StatusInternalServerError, "", err)
	}

	return response.JSON(status, newTestReceiversResult(result))
}

func (srv AlertmanagerSrv) RoutePostTestTemplates(c *contextmodel.ReqContext, body apimodels.TestTemplatesConfigBodyParams) response.Response {
	am, errResp := srv.AlertmanagerFor(c.SignedInUser.GetOrgID())
	if errResp != nil {
		return errResp
	}

	res, err := am.TestTemplate(c.Req.Context(), body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "", err)
	}

	return response.JSON(http.StatusOK, newTestTemplateResult(res))
}

// contextWithTimeoutFromRequest returns a context with a deadline set from the
// Request-Timeout header in the HTTP request. If the header is absent then the
// context will use the default timeout. The timeout in the Request-Timeout
// header cannot exceed the maximum timeout.
func contextWithTimeoutFromRequest(ctx context.Context, r *http.Request, defaultTimeout, maxTimeout time.Duration) (context.Context, context.CancelFunc, error) {
	timeout := defaultTimeout
	if s := strings.TrimSpace(r.Header.Get("Request-Timeout")); s != "" {
		// the timeout is measured in seconds
		v, err := strconv.ParseInt(s, 10, 16)
		if err != nil {
			return nil, nil, err
		}
		if d := time.Duration(v) * time.Second; d < maxTimeout {
			timeout = d
		} else {
			return nil, nil, fmt.Errorf("exceeded maximum timeout of %d seconds", maxTimeout)
		}
	}
	ctx, cancelFunc := context.WithTimeout(ctx, timeout)
	return ctx, cancelFunc, nil
}

func newTestReceiversResult(r *alertingNotify.TestReceiversResult) apimodels.TestReceiversResult {
	v := apimodels.TestReceiversResult{
		Alert: apimodels.TestReceiversConfigAlertParams{
			Annotations: r.Alert.Annotations,
			Labels:      r.Alert.Labels,
		},
		Receivers:  make([]apimodels.TestReceiverResult, len(r.Receivers)),
		NotifiedAt: r.NotifedAt,
	}
	for ix, next := range r.Receivers {
		configs := make([]apimodels.TestReceiverConfigResult, len(next.Configs))
		for jx, config := range next.Configs {
			configs[jx].Name = config.Name
			configs[jx].UID = config.UID
			configs[jx].Status = config.Status
			configs[jx].Error = config.Error
		}
		v.Receivers[ix].Configs = configs
		v.Receivers[ix].Name = next.Name
	}
	return v
}

func newTestTemplateResult(res *notifier.TestTemplatesResults) apimodels.TestTemplatesResults {
	apiRes := apimodels.TestTemplatesResults{}
	for _, r := range res.Results {
		apiRes.Results = append(apiRes.Results, apimodels.TestTemplatesResult{
			Name:  r.Name,
			Text:  r.Text,
			Scope: apimodels.TemplateScope(r.Scope),
		})
	}
	for _, e := range res.Errors {
		apiRes.Errors = append(apiRes.Errors, apimodels.TestTemplatesErrorResult{
			Name:    e.Name,
			Kind:    apimodels.TemplateErrorKind(e.Kind),
			Message: e.Error,
		})
	}
	return apiRes
}

func (srv AlertmanagerSrv) AlertmanagerFor(orgID int64) (notifier.Alertmanager, *response.NormalResponse) {
	am, err := srv.mam.AlertmanagerFor(orgID)
	if err == nil {
		return am, nil
	}

	if errors.Is(err, notifier.ErrNoAlertmanagerForOrg) {
		return nil, response.Error(http.StatusNotFound, err.Error(), err)
	}
	if errors.Is(err, notifier.ErrAlertmanagerNotReady) {
		return am, response.Error(http.StatusConflict, err.Error(), err)
	}

	srv.log.Error("Unable to obtain the org's Alertmanager", "error", err)
	return nil, response.Error(http.StatusInternalServerError, "unable to obtain org's Alertmanager", err)
}

type ReceiverStatus apimodels.Receiver

func (rs ReceiverStatus) GetUID() string {
	return legacy_storage.NameToUid(rs.Name)
}
