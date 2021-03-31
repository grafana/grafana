package api

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"gopkg.in/yaml.v3"

	"github.com/go-openapi/strfmt"
	apimodels "github.com/grafana/alerting-api/pkg/api"
	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/notifier"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
)

type AlertmanagerSrv struct {
	am    Alertmanager
	store store.AlertingStore
	log   log.Logger
}

func (srv AlertmanagerSrv) RouteCreateSilence(c *models.ReqContext, postableSilence apimodels.PostableSilence) response.Response {
	silenceID, err := srv.am.CreateSilence(&postableSilence)
	if err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}

		if errors.Is(err, notifier.ErrCreateSilenceBadPayload) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}

		return response.Error(http.StatusInternalServerError, "failed to create silence", err)
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "silence created", "id": silenceID})
}

func (srv AlertmanagerSrv) RouteDeleteAlertingConfig(c *models.ReqContext) response.Response {
	// not implemented
	return response.Error(http.StatusNotImplemented, "", nil)
}

func (srv AlertmanagerSrv) RouteDeleteSilence(c *models.ReqContext) response.Response {
	silenceID := c.Params(":SilenceId")
	if err := srv.am.DeleteSilence(silenceID); err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}
	return response.JSON(http.StatusOK, util.DynMap{"message": "silence deleted"})
}

func (srv AlertmanagerSrv) RouteGetAlertingConfig(c *models.ReqContext) response.Response {
	query := ngmodels.GetLatestAlertmanagerConfigurationQuery{}
	err := srv.store.GetLatestAlertmanagerConfiguration(&query)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get latest configuration", err)
	}

	cfg := apimodels.PostableUserConfig{}
	err = yaml.Unmarshal([]byte(query.Result.AlertmanagerConfiguration), &cfg)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to unmarshal alertmanager configuration", err)
	}

	var apiReceiverName string
	var receivers []*apimodels.GettableGrafanaReceiver
	alertmanagerCfg := cfg.AlertmanagerConfig
	if len(alertmanagerCfg.Receivers) > 0 {
		apiReceiverName = alertmanagerCfg.Receivers[0].Name
		receivers = make([]*apimodels.GettableGrafanaReceiver, 0, len(alertmanagerCfg.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers))
		for _, pr := range alertmanagerCfg.Receivers[0].PostableGrafanaReceivers.GrafanaManagedReceivers {
			secureFields := make(map[string]bool, len(pr.SecureSettings))
			for k := range pr.SecureSettings {
				secureFields[k] = true
			}
			gr := apimodels.GettableGrafanaReceiver{
				Uid:                   pr.Uid,
				Name:                  pr.Name,
				Type:                  pr.Type,
				IsDefault:             pr.IsDefault,
				SendReminder:          pr.SendReminder,
				DisableResolveMessage: pr.DisableResolveMessage,
				Frequency:             pr.Frequency,
				Settings:              pr.Settings,
				SecureFields:          secureFields,
			}
			receivers = append(receivers, &gr)
		}
	}

	gettableApiReceiver := apimodels.GettableApiReceiver{
		GettableGrafanaReceivers: apimodels.GettableGrafanaReceivers{
			GrafanaManagedReceivers: receivers,
		},
	}
	gettableApiReceiver.Name = apiReceiverName
	result := apimodels.GettableUserConfig{
		TemplateFiles: cfg.TemplateFiles,
		AlertmanagerConfig: apimodels.GettableApiAlertingConfig{
			Config: alertmanagerCfg.Config,
			Receivers: []*apimodels.GettableApiReceiver{
				&gettableApiReceiver,
			},
		},
	}

	return response.JSON(http.StatusOK, result)
}

func (srv AlertmanagerSrv) RouteGetAMAlertGroups(c *models.ReqContext) response.Response {
	recipient := c.Params(":Recipient")
	srv.log.Info("RouteGetAMAlertGroups: ", "Recipient", recipient)
	now := time.Now()
	result := apimodels.AlertGroups{
		&amv2.AlertGroup{
			Alerts: []*amv2.GettableAlert{
				{
					Annotations: amv2.LabelSet{
						"annotation1-1": "value1",
						"annotation1-2": "value2",
					},
					EndsAt:      timePtr(strfmt.DateTime(now.Add(time.Hour))),
					Fingerprint: stringPtr("fingerprint 1"),
					Receivers: []*amv2.Receiver{
						{
							Name: stringPtr("receiver identifier 1-1"),
						},
						{
							Name: stringPtr("receiver identifier 1-2"),
						},
					},
					StartsAt: timePtr(strfmt.DateTime(now)),
					Status: &amv2.AlertStatus{
						InhibitedBy: []string{"inhibitedBy 1"},
						SilencedBy:  []string{"silencedBy 1"},
						State:       stringPtr(amv2.AlertStatusStateActive),
					},
					UpdatedAt: timePtr(strfmt.DateTime(now.Add(-time.Hour))),
					Alert: amv2.Alert{
						GeneratorURL: strfmt.URI("a URL"),
						Labels: amv2.LabelSet{
							"label1-1": "value1",
							"label1-2": "value2",
						},
					},
				},
				{
					Annotations: amv2.LabelSet{
						"annotation2-1": "value1",
						"annotation2-2": "value2",
					},
					EndsAt:      timePtr(strfmt.DateTime(now.Add(time.Hour))),
					Fingerprint: stringPtr("fingerprint 2"),
					Receivers: []*amv2.Receiver{
						{
							Name: stringPtr("receiver identifier 2-1"),
						},
						{
							Name: stringPtr("receiver identifier 2-2"),
						},
					},
					StartsAt: timePtr(strfmt.DateTime(now)),
					Status: &amv2.AlertStatus{
						InhibitedBy: []string{"inhibitedBy 2"},
						SilencedBy:  []string{"silencedBy 2"},
						State:       stringPtr(amv2.AlertStatusStateActive),
					},
					UpdatedAt: timePtr(strfmt.DateTime(now.Add(-time.Hour))),
					Alert: amv2.Alert{
						GeneratorURL: strfmt.URI("a URL"),
						Labels: amv2.LabelSet{
							"label2-1": "value1",
							"label2-2": "value2",
						},
					},
				},
			},
			Labels: amv2.LabelSet{
				"label1-1": "value1",
				"label1-2": "value2",
			},
			Receiver: &amv2.Receiver{
				Name: stringPtr("receiver identifier 2-1"),
			},
		},
		&amv2.AlertGroup{
			Alerts: []*amv2.GettableAlert{
				{
					Annotations: amv2.LabelSet{
						"annotation2-1": "value1",
						"annotation2-2": "value2",
					},
					EndsAt:      timePtr(strfmt.DateTime(now.Add(time.Hour))),
					Fingerprint: stringPtr("fingerprint 2"),
					Receivers: []*amv2.Receiver{
						{
							Name: stringPtr("receiver identifier 2-1"),
						},
						{
							Name: stringPtr("receiver identifier 2-2"),
						},
					},
					StartsAt: timePtr(strfmt.DateTime(now)),
					Status: &amv2.AlertStatus{
						InhibitedBy: []string{"inhibitedBy 2"},
						SilencedBy:  []string{"silencedBy 2"},
						State:       stringPtr(amv2.AlertStatusStateActive),
					},
					UpdatedAt: timePtr(strfmt.DateTime(now.Add(-time.Hour))),
					Alert: amv2.Alert{
						GeneratorURL: strfmt.URI("a URL"),
						Labels: amv2.LabelSet{
							"label2-1": "value1",
							"label2-2": "value2",
						},
					},
				},
			},
			Labels: amv2.LabelSet{
				"label2-1": "value1",
				"label2-2": "value2",
			},
			Receiver: &amv2.Receiver{
				Name: stringPtr("receiver identifier 2-1"),
			},
		},
	}
	return response.JSON(http.StatusOK, result)
}

func (srv AlertmanagerSrv) RouteGetAMAlerts(c *models.ReqContext) response.Response {
	recipient := c.Params(":Recipient")
	srv.log.Info("RouteGetAMAlerts: ", "Recipient", recipient)
	now := time.Now()
	result := apimodels.GettableAlerts{
		&amv2.GettableAlert{
			Annotations: amv2.LabelSet{
				"annotation1-1": "value1",
				"annotation1-2": "value2",
			},
			EndsAt:      timePtr(strfmt.DateTime(now.Add(time.Hour))),
			Fingerprint: stringPtr("fingerprint 1"),
			Receivers: []*amv2.Receiver{
				{
					Name: stringPtr("receiver identifier 1-1"),
				},
				{
					Name: stringPtr("receiver identifier 1-2"),
				},
			},
			StartsAt: timePtr(strfmt.DateTime(now)),
			Status: &amv2.AlertStatus{
				InhibitedBy: []string{"inhibitedBy 1"},
				SilencedBy:  []string{"silencedBy 1"},
				State:       stringPtr(amv2.AlertStatusStateActive),
			},
			UpdatedAt: timePtr(strfmt.DateTime(now.Add(-time.Hour))),
			Alert: amv2.Alert{
				GeneratorURL: strfmt.URI("a URL"),
				Labels: amv2.LabelSet{
					"label1-1": "value1",
					"label1-2": "value2",
				},
			},
		},
		&amv2.GettableAlert{
			Annotations: amv2.LabelSet{
				"annotation2-1": "value1",
				"annotation2-2": "value2",
			},
			EndsAt:      timePtr(strfmt.DateTime(now.Add(time.Hour))),
			Fingerprint: stringPtr("fingerprint 2"),
			Receivers: []*amv2.Receiver{
				{
					Name: stringPtr("receiver identifier 2-1"),
				},
				{
					Name: stringPtr("receiver identifier 2-2"),
				},
			},
			StartsAt: timePtr(strfmt.DateTime(now)),
			Status: &amv2.AlertStatus{
				InhibitedBy: []string{"inhibitedBy 2"},
				SilencedBy:  []string{"silencedBy 2"},
				State:       stringPtr(amv2.AlertStatusStateActive),
			},
			UpdatedAt: timePtr(strfmt.DateTime(now.Add(-time.Hour))),
			Alert: amv2.Alert{
				GeneratorURL: strfmt.URI("a URL"),
				Labels: amv2.LabelSet{
					"label2-1": "value1",
					"label2-2": "value2",
				},
			},
		},
	}
	return response.JSON(http.StatusOK, result)
}

func (srv AlertmanagerSrv) RouteGetSilence(c *models.ReqContext) response.Response {
	silenceID := c.Params(":SilenceId")
	gettableSilence, err := srv.am.GetSilence(silenceID)
	if err != nil {
		if errors.Is(err, notifier.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, err.Error(), nil)
		}
		// any other error here should be an unexpected failure and thus an internal error
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}
	return response.JSON(http.StatusOK, gettableSilence)
}

func (srv AlertmanagerSrv) RouteGetSilences(c *models.ReqContext) response.Response {
	filters := c.QueryStrings("Filter")
	gettableSilences, err := srv.am.ListSilences(filters)
	if err != nil {
		if errors.Is(err, notifier.ErrListSilencesBadPayload) {
			return response.Error(http.StatusBadRequest, err.Error(), nil)
		}
		// any other error here should be an unexpected failure and thus an internal error
		return response.Error(http.StatusInternalServerError, err.Error(), nil)
	}
	return response.JSON(http.StatusOK, gettableSilences)
}

func (srv AlertmanagerSrv) RoutePostAlertingConfig(c *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	config, err := yaml.Marshal(&body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to serialize to the Alertmanager configuration", err)
	}

	cmd := ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(config),
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
	}
	if err := srv.store.SaveAlertmanagerConfiguration(&cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to save Alertmanager configuration", err)
	}

	if err := srv.am.ApplyConfig(&body); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to apply Alertmanager configuration", err)
	}

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration created"})
}

func (srv AlertmanagerSrv) RoutePostAMAlerts(c *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	// not implemented
	return response.Error(http.StatusNotImplemented, "", nil)
}
