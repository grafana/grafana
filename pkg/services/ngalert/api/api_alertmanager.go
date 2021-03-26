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
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/util"
	amv2 "github.com/prometheus/alertmanager/api/v2/models"
)

type AlertmanagerSrv struct {
	store store.AlertingStore
	log   log.Logger
}

func (srv AlertmanagerSrv) RouteCreateSilence(c *models.ReqContext, body apimodels.SilenceBody) response.Response {
	cmd := ngmodels.SaveSilenceCommand{
		UID:   body.Id,
		OrgID: c.SignedInUser.OrgId,
	}
	cmd.Comment = body.Comment
	cmd.CreatedBy = body.CreatedBy
	cmd.EndsAt = body.EndsAt
	cmd.Matchers = body.Matchers
	cmd.StartsAt = body.StartsAt
	if err := srv.store.SaveSilence(&cmd); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to create silence", err)
	}
	return response.JSON(http.StatusAccepted, util.DynMap{"message": "silence created"})
}

func (srv AlertmanagerSrv) RouteDeleteAlertingConfig(c *models.ReqContext) response.Response {
	// not implemented
	return response.Error(http.StatusNotImplemented, "", nil)
}

func (srv AlertmanagerSrv) RouteDeleteSilence(c *models.ReqContext) response.Response {
	silenceID := c.Params(":SilenceId")
	srv.log.Info("RouteGetSilence: ", "SilenceId", silenceID)
	q := ngmodels.DeleteSilenceByUIDCommand{OrgID: c.SignedInUser.OrgId, UID: silenceID}
	if err := srv.store.DeleteSilenceByUID(&q); err != nil {
		if errors.Is(err, ngmodels.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, "silence not found", err)
		}
		return response.Error(http.StatusInternalServerError, "failed to delete silence", err)
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

func (srv AlertmanagerSrv) RouteGetAmAlertGroups(c *models.ReqContext) response.Response {
	datasourceID := c.Params(":DatasourceId")
	srv.log.Info("RouteGetAmAlertGroups: ", "DatasourceId", datasourceID)
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

func (srv AlertmanagerSrv) RouteGetAmAlerts(c *models.ReqContext) response.Response {
	datasourceID := c.Params(":DatasourceId")
	srv.log.Info("RouteGetAmAlerts: ", "DatasourceId", datasourceID)
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
	srv.log.Info("RouteGetSilence: ", "SilenceId", silenceID)
	q := ngmodels.GetSilenceByUIDQuery{OrgID: c.SignedInUser.OrgId, UID: silenceID}
	if err := srv.store.GetSilenceByUID(&q); err != nil {
		if errors.Is(err, ngmodels.ErrSilenceNotFound) {
			return response.Error(http.StatusNotFound, "silence not found", err)
		}
		return response.Error(http.StatusInternalServerError, "failed to get silence", err)
	}

	return response.JSON(http.StatusOK, q.Result.ToGettableSilence())
}

func (srv AlertmanagerSrv) RouteGetSilences(c *models.ReqContext) response.Response {
	q := ngmodels.GetSilencesQuery{OrgID: c.SignedInUser.OrgId}
	if err := srv.store.GetOrgSilences(&q); err != nil {
		return response.Error(http.StatusInternalServerError, "failed to get silences", err)
	}
	result := apimodels.GettableSilences{}
	for _, s := range q.Result {
		gettableSilence := s.ToGettableSilence()
		result = append(result, &gettableSilence)
	}
	return response.JSON(http.StatusOK, result)
}

func (srv AlertmanagerSrv) RoutePostAlertingConfig(c *models.ReqContext, body apimodels.PostableUserConfig) response.Response {
	config, err := yaml.Marshal(&body)
	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to serialize to the Alertmanager configuration", err)
	}

	err = srv.store.SaveAlertmanagerConfiguration(&ngmodels.SaveAlertmanagerConfigurationCmd{
		AlertmanagerConfiguration: string(config),
		ConfigurationVersion:      fmt.Sprintf("v%d", ngmodels.AlertConfigurationVersion),
	})

	if err != nil {
		return response.Error(http.StatusInternalServerError, "failed to save Alertmanager configuration", err)
	}

	// reloadConfigFromDatabase

	return response.JSON(http.StatusAccepted, util.DynMap{"message": "configuration created"})
}

func (srv AlertmanagerSrv) RoutePostAmAlerts(c *models.ReqContext, body apimodels.PostableAlerts) response.Response {
	// not implemented
	return response.Error(http.StatusNotImplemented, "", nil)
}
