package alerting

import (
	"context"
	"errors"
	"fmt"

	"github.com/xorcare/pointer"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/dashboards"
	alert_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
}

func NewAlertRuleProvisioner(
	logger log.Logger,
	dashboardService dashboards.DashboardService,
	dashboardProvService dashboards.DashboardProvisioningService,
	ruleService provisioning.AlertRuleService) AlertRuleProvisioner {
	return &defaultAlertRuleProvisioner{
		logger:               logger,
		dashboardService:     dashboardService,
		dashboardProvService: dashboardProvService,
		ruleService:          ruleService,
	}
}

type defaultAlertRuleProvisioner struct {
	logger               log.Logger
	dashboardService     dashboards.DashboardService
	dashboardProvService dashboards.DashboardProvisioningService
	ruleService          provisioning.AlertRuleService
}

func (prov *defaultAlertRuleProvisioner) Provision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, group := range file.Groups {
			folderUID, err := prov.getOrCreateFolderUID(ctx, group.FolderTitle, group.OrgID)
			if err != nil {
				return err
			}
			prov.logger.Debug("provisioning alert rule group",
				"org", group.OrgID,
				"folder", group.FolderTitle,
				"folderUID", folderUID,
				"name", group.Title)
			for _, rule := range group.Rules {
				rule.NamespaceUID = folderUID
				rule.RuleGroup = group.Title
				err = prov.provisionRule(ctx, group.OrgID, rule)
				if err != nil {
					return err
				}
			}
			err = prov.ruleService.UpdateRuleGroup(ctx, group.OrgID, folderUID, group.Title, group.Interval)
			if err != nil {
				return err
			}
		}
		for _, deleteRule := range file.DeleteRules {
			err := prov.ruleService.DeleteAlertRule(ctx, deleteRule.OrgID,
				deleteRule.UID, alert_models.ProvenanceFile)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (prov *defaultAlertRuleProvisioner) provisionRule(
	ctx context.Context,
	orgID int64,
	rule alert_models.AlertRule) error {
	prov.logger.Debug("provisioning alert rule", "uid", rule.UID, "org", rule.OrgID)
	_, _, err := prov.ruleService.GetAlertRule(ctx, orgID, rule.UID)
	if err != nil && !errors.Is(err, alert_models.ErrAlertRuleNotFound) {
		return err
	} else if err != nil {
		prov.logger.Debug("creating rule", "uid", rule.UID, "org", rule.OrgID)
		// 0 is passed as userID as then the quota logic will only check for
		// the organization quota, as we don't have any user scope here.
		_, err = prov.ruleService.CreateAlertRule(ctx, rule, alert_models.ProvenanceFile, 0)
	} else {
		prov.logger.Debug("updating rule", "uid", rule.UID, "org", rule.OrgID)
		_, err = prov.ruleService.UpdateAlertRule(ctx, rule, alert_models.ProvenanceFile)
	}
	return err
}

func (prov *defaultAlertRuleProvisioner) getOrCreateFolderUID(
	ctx context.Context, folderName string, orgID int64) (string, error) {
	cmd := &dashboards.GetDashboardQuery{
		Title:    &folderName,
		FolderID: pointer.Int64(0),
		OrgID:    orgID,
	}
	cmdResult, err := prov.dashboardService.GetDashboard(ctx, cmd)
	if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return "", err
	}

	// dashboard folder not found. create one.
	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		dash := &dashboards.SaveDashboardDTO{}
		dash.Dashboard = dashboards.NewDashboardFolder(folderName)
		dash.Dashboard.IsFolder = true
		dash.Overwrite = true
		dash.OrgID = orgID
		dash.Dashboard.SetUID(util.GenerateShortUID())
		dbDash, err := prov.dashboardProvService.SaveFolderForProvisionedDashboards(ctx, dash)
		if err != nil {
			return "", err
		}

		return dbDash.UID, nil
	}

	if !cmdResult.IsFolder {
		return "", fmt.Errorf("got invalid response. expected folder, found dashboard")
	}

	return cmdResult.UID, nil
}
