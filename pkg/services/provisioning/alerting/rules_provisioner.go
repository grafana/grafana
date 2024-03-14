package alerting

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	alert_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/user"
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
			u := provisionerUser(group.OrgID)
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
				err = prov.provisionRule(ctx, u, rule)
				if err != nil {
					return err
				}
			}
			err = prov.ruleService.UpdateRuleGroup(ctx, u, folderUID, group.Title, group.Interval)
			if err != nil {
				return err
			}
		}
		for _, deleteRule := range file.DeleteRules {
			err := prov.ruleService.DeleteAlertRule(ctx, provisionerUser(deleteRule.OrgID), deleteRule.UID, alert_models.ProvenanceFile)
			if err != nil {
				return err
			}
		}
	}
	return nil
}

func (prov *defaultAlertRuleProvisioner) provisionRule(
	ctx context.Context,
	user identity.Requester,
	rule alert_models.AlertRule) error {
	prov.logger.Debug("provisioning alert rule", "uid", rule.UID, "org", rule.OrgID)
	_, _, err := prov.ruleService.GetAlertRule(ctx, user, rule.UID)
	if err != nil && !errors.Is(err, alert_models.ErrAlertRuleNotFound) {
		return err
	} else if err != nil {
		prov.logger.Debug("creating rule", "uid", rule.UID, "org", rule.OrgID)
		// a nil user is passed in as then the quota logic will only check for
		// the organization quota since we don't have any user scope here.
		_, err = prov.ruleService.CreateAlertRule(ctx, user, rule, alert_models.ProvenanceFile)
	} else {
		prov.logger.Debug("updating rule", "uid", rule.UID, "org", rule.OrgID)
		_, err = prov.ruleService.UpdateAlertRule(ctx, user, rule, alert_models.ProvenanceFile)
	}
	return err
}

func (prov *defaultAlertRuleProvisioner) getOrCreateFolderUID(
	ctx context.Context, folderName string, orgID int64) (string, error) {
	metrics.MFolderIDsServiceCount.WithLabelValues(metrics.Provisioning).Inc()
	cmd := &dashboards.GetDashboardQuery{
		Title:    &folderName,
		FolderID: util.Pointer(int64(0)), // nolint:staticcheck
		OrgID:    orgID,
	}
	cmdResult, err := prov.dashboardService.GetDashboard(ctx, cmd)
	if err != nil && !errors.Is(err, dashboards.ErrDashboardNotFound) {
		return "", err
	}

	// dashboard folder not found. create one.
	if errors.Is(err, dashboards.ErrDashboardNotFound) {
		createCmd := &folder.CreateFolderCommand{
			OrgID: orgID,
			UID:   util.GenerateShortUID(),
			Title: folderName,
		}
		dbDash, err := prov.dashboardProvService.SaveFolderForProvisionedDashboards(ctx, createCmd)
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

// UserID is 0 to use org quota
var provisionerUser = func(orgID int64) identity.Requester {
	return &user.SignedInUser{UserID: 0, Login: "alert_provisioner", OrgID: orgID}
}
