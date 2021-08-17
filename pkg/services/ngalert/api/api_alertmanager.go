package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
)

const (
	defaultTestReceiversTimeout = 15 * time.Second
	maxTestReceiversTimeout     = 30 * time.Second
)

type AlertmanagerSrv struct {
	am    Alertmanager
	store store.AlertingStore
	log   log.Logger
}

type UnknownReceiverError struct {
	UID string
}

func (e UnknownReceiverError) Error() string {
	return fmt.Sprintf("unknown receiver: %s", e.UID)
}

func (srv AlertmanagerSrv) loadSecureSettings(orgId int64, receivers []*apimodels.PostableApiReceiver) error {
	// Get the last known working configuration
	query := ngmodels.GetLatestAlertmanagerConfigurationQuery{OrgID: orgId}
	if err := srv.store.GetLatestAlertmanagerConfiguration(&query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return fmt.Errorf("failed to get latest configuration: %w", err)
		}
	}

	currentReceiverMap := make(map[string]*apimodels.PostableGrafanaReceiver)
	if query.Result != nil {
		currentConfig, err := notifier.Load([]byte(query.Result.AlertmanagerConfiguration))
		if err != nil {
			return fmt.Errorf("failed to load latest configuration: %w", err)
		}
		currentReceiverMap = currentConfig.GetGrafanaReceiverMap()
	}

	// Copy the previously known secure settings
	for i, r := range receivers {
		for j, gr := range r.PostableGrafanaReceivers.GrafanaManagedReceivers {
			if gr.UID == "" { // new receiver
				continue
			}

			cgmr, ok := currentReceiverMap[gr.UID]
			if !ok {
				// it tries to update a receiver that didn't previously exist
				return UnknownReceiverError{UID: gr.UID}
			}

			// frontend sends only the secure settings that have to be updated
			// therefore we have to copy from the last configuration only those secure settings not included in the request
			for key := range cgmr.SecureSettings {
				_, ok := gr.SecureSettings[key]
				if !ok {
					decryptedValue, err := cgmr.GetDecryptedSecret(key)
					if err != nil {
						return fmt.Errorf("failed to decrypt stored secure setting: %s: %w", key, err)
					}

					if receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings == nil {
						receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings = make(map[string]string, len(cgmr.SecureSettings))
					}

					receivers[i].PostableGrafanaReceivers.GrafanaManagedReceivers[j].SecureSettings[key] = decryptedValue
				}
			}
		}
	}
	return nil
}

func (srv AlertmanagerSrv) RouteGetAMStatus(c *models.ReqContext) response.Response {
	return response.JSON(http.StatusOK, srv.am.GetStatus())
}

func (srv AlertmanagerSrv) RouteCreateSilence(c *models.ReqContext, postableSilence apimodels.PostableSilence) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	silenceID, err := srv.am.CreateSilence(&postableSilence)
	if err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}

		if errors.Is(err, notifier.ErrCreateSilenceBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}

		return ErrResp(http.StatusInternalServerError, err, "failed to create silence")
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "silence created", "id": silenceID})
}

func (srv AlertmanagerSrv) RouteDeleteAlertingConfig(c *models.ReqContext) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	if err := srv.am.SaveAndApplyDefaultConfig(c.OrgId); err != nil {
		srv.log.Error("unable to save and apply default alertmanager configuration", "err", err)
		return ErrResp(http.StatusInternalServerError, err, "failed to save and apply default Alertmanager configuration")
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration deleted; the default is applied"})
}

func (srv AlertmanagerSrv) RouteDeleteSilence(c *models.ReqContext) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}
	silenceID := c.Params(":SilenceId")
	if err := srv.am.DeleteSilence(silenceID); err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "silence deleted"})
}

func (srv AlertmanagerSrv) RouteGetAlertingConfig(c *models.ReqContext) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}

	query := ngmodels.GetLatestAlertmanagerConfigurationQuery{OrgID: c.OrgId}
	if err := srv.store.GetLatestAlertmanagerConfiguration(&query); err != nil {
		if errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "failed to get latest configuration")
	}

	cfg, err := notifier.Load([]byte(query.Result.AlertmanagerConfiguration))
	if err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to unmarshal alertmanager configuration")
	}

	result := apimodels.GettableUserConfig{
		TemplateFiles: cfg.TemplateFiles,
		AlertmanagerConfig: apimodels.GettableApiAlertingConfig{
			Config: cfg.AlertmanagerConfig.Config,
		},
	}
	for _, recv := range cfg.AlertmanagerConfig.Receivers {
		receivers := make([]*apimodels.GettableGrafanaReceiver, 0, len(recv.PostableGrafanaReceivers.GrafanaManagedReceivers))
		for _, pr := range recv.PostableGrafanaReceivers.GrafanaManagedReceivers {
			secureFields := make(map[string]bool, len(pr.SecureSettings))
			for k := range pr.SecureSettings {
				decryptedValue, err := pr.GetDecryptedSecret(k)
				if err != nil {
					return ErrResp(http.StatusInternalServerError, err, "failed to decrypt stored secure setting: %s", k)
				}
				if decryptedValue == "" {
					continue
				}
				secureFields[k] = true
			}
			gr := apimodels.GettableGrafanaReceiver{
				UID:                   pr.UID,
				Name:                  pr.Name,
				Type:                  pr.Type,
				DisableResolveMessage: pr.DisableResolveMessage,
				Settings:              pr.Settings,
				SecureFields:          secureFields,
			}
			receivers = append(receivers, &gr)
		}
		gettableApiReceiver := apimodels.GettableApiReceiver{
			GettableGrafanaReceivers: apimodels.GettableGrafanaReceivers{
				GrafanaManagedReceivers: receivers,
			},
		}
		gettableApiReceiver.Name = recv.Name
		result.AlertmanagerConfig.Receivers = append(result.AlertmanagerConfig.Receivers, &gettableApiReceiver)
	}

	return response.JSON(http.StatusOK, result)
}

func (srv AlertmanagerSrv) RouteGetAMAlertGroups(c *models.ReqContext) response.Response {
	groups, err := srv.am.GetAlertGroups(
		c.QueryBoolWithDefault("active", true),
		c.QueryBoolWithDefault("silenced", true),
		c.QueryBoolWithDefault("inhibited", true),
		c.QueryStrings("filter"),
		c.Query("receiver"),
	)
	if err != nil {
		if errors.Is(err, notifier.ErrGetAlertGroupsBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, groups)
}

func (srv AlertmanagerSrv) RouteGetAMAlerts(c *models.ReqContext) response.Response {
	alerts, err := srv.am.GetAlerts(
		c.QueryBoolWithDefault("active", true),
		c.QueryBoolWithDefault("silenced", true),
		c.QueryBoolWithDefault("inhibited", true),
		c.QueryStrings("filter"),
		c.Query("receiver"),
	)
	if err != nil {
		if errors.Is(err, notifier.ErrGetAlertsBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		if errors.Is(err, notifier.ErrGetAlertsUnavailable) {
			return ErrResp(http.StatusServiceUnavailable, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	return response.JSON(http.StatusOK, alerts)
}

func (srv AlertmanagerSrv) RouteGetSilence(c *models.ReqContext) response.Response {
	silenceID := c.Params(":SilenceId")
	gettableSilence, err := srv.am.GetSilence(silenceID)
	if err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return ErrResp(http.StatusNotFound, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, gettableSilence)
}

func (srv AlertmanagerSrv) RouteGetSilences(c *models.ReqContext) response.Response {
	gettableSilences, err := srv.am.ListSilences(c.QueryStrings("filter"))
	if err != nil {
		if errors.Is(err, notifier.ErrListSilencesBadPayload) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		// any other error here should be an unexpected failure and thus an internal error
		return ErrResp(http.StatusInternalServerError, err, "")
	}
	return response.JSON(http.StatusOK, gettableSilences)
}

func (srv AlertmanagerSrv) RoutePostAlertingConfig(c *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return ErrResp(http.StatusForbidden, errors.New("permission denied"), "")
	}

	// Get the last known working configuration
	query := ngmodels.GetLatestAlertmanagerConfigurationQuery{OrgID: c.OrgId}
	if err := srv.store.GetLatestAlertmanagerConfiguration(&query); err != nil {
		// If we don't have a configuration there's nothing for us to know and we should just continue saving the new one
		if !errors.Is(err, store.ErrNoAlertmanagerConfiguration) {
			return ErrResp(http.StatusInternalServerError, err, "failed to get latest configuration")
		}
	}

	if err := srv.loadSecureSettings(c.OrgId, body.AlertmanagerConfig.Receivers); err != nil {
		var unknownReceiverError UnknownReceiverError
		if errors.As(err, &unknownReceiverError) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	if err := body.ProcessConfig(); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to post process Alertmanager configuration")
	}

	if err := srv.am.SaveAndApplyConfig(c.OrgId, &body); err != nil {
		srv.log.Error("unable to save and apply alertmanager configuration", "err", err)
		return ErrResp(http.StatusBadRequest, err, "failed to save and apply Alertmanager configuration")
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration created"})
}

func (srv AlertmanagerSrv) RoutePostAMAlerts(c *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	return NotImplementedResp
}

func (srv AlertmanagerSrv) RoutePostTestReceivers(c *models.ReqContext, body apimodels.TestReceiversConfigParams) response.Response {
	if !c.HasUserRole(models.ROLE_EDITOR) {
		return accessForbiddenResp()
	}

	if err := srv.loadSecureSettings(c.OrgId, body.Receivers); err != nil {
		var unknownReceiverError UnknownReceiverError
		if errors.As(err, &unknownReceiverError) {
			return ErrResp(http.StatusBadRequest, err, "")
		}
		return ErrResp(http.StatusInternalServerError, err, "")
	}

	if err := body.ProcessConfig(); err != nil {
		return ErrResp(http.StatusInternalServerError, err, "failed to post process Alertmanager configuration")
	}

	ctx, cancelFunc, err := contextWithTimeoutFromRequest(
		c.Req.Context(),
		c.Req.Request,
		defaultTestReceiversTimeout,
		maxTestReceiversTimeout)
	if err != nil {
		return ErrResp(http.StatusBadRequest, err, "")
	}
	defer cancelFunc()

	result, err := srv.am.TestReceivers(ctx, body)
	if err != nil {
		if errors.Is(err, notifier.ErrNoReceivers) {
			return response.Error(http.StatusBadRequest, "", err)
		}
		return response.Error(http.StatusInternalServerError, "", err)
	}

	return response.JSON(statusForTestReceivers(result.Receivers), newTestReceiversResult(result))
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

func newTestReceiversResult(r *notifier.TestReceiversResult) apimodels.TestReceiversResult {
	v := apimodels.TestReceiversResult{
		Receivers: make([]apimodels.TestReceiverResult, len(r.Receivers)),
		NotifedAt: r.NotifedAt,
	}
	for ix, next := range r.Receivers {
		configs := make([]apimodels.TestReceiverConfigResult, len(next.Configs))
		for jx, config := range next.Configs {
			configs[jx].Name = config.Name
			configs[jx].UID = config.UID
			configs[jx].Status = config.Status
			if config.Error != nil {
				configs[jx].Error = config.Error.Error()
			}
		}
		v.Receivers[ix].Configs = configs
		v.Receivers[ix].Name = next.Name
	}
	return v
}

// statusForTestReceivers returns the appropriate status code for the response
// for the results.
//
// It returns an HTTP 200 OK status code if notifications were sent to all receivers,
// an HTTP 400 Bad Request status code if all receivers contain invalid configuration,
// an HTTP 408 Request Timeout status code if all receivers timed out when sending
// a test notification or an HTTP 207 Multi Status.
func statusForTestReceivers(v []notifier.TestReceiverResult) int {
	var (
		numBadRequests   int
		numTimeouts      int
		numUnknownErrors int
	)
	for _, receiver := range v {
		for _, next := range receiver.Configs {
			if next.Error != nil {
				var (
					invalidReceiverErr notifier.InvalidReceiverError
					receiverTimeoutErr notifier.ReceiverTimeoutError
				)
				if errors.As(next.Error, &invalidReceiverErr) {
					numBadRequests += 1
				} else if errors.As(next.Error, &receiverTimeoutErr) {
					numTimeouts += 1
				} else {
					numUnknownErrors += 1
				}
			}
		}
	}
	if numBadRequests == len(v) {
		// if all receivers contain invalid configuration
		return http.StatusBadRequest
	} else if numTimeouts == len(v) {
		// if all receivers contain valid configuration but timed out
		return http.StatusRequestTimeout
	} else if numBadRequests+numTimeouts+numUnknownErrors > 0 {
		return http.StatusMultiStatus
	} else {
		// all receivers were sent a notification without error
		return http.StatusOK
	}
}
