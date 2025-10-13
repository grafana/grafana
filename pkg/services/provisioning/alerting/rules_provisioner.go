package alerting

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	alert_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
}

func NewAlertRuleProvisioner(
	logger log.Logger,
	folderService folder.Service,
	dashboardProvService dashboards.DashboardProvisioningService,
	ruleService provisioning.AlertRuleService) AlertRuleProvisioner {
	return &defaultAlertRuleProvisioner{
		logger:               logger,
		folderService:        folderService,
		dashboardProvService: dashboardProvService,
		ruleService:          ruleService,
	}
}

type defaultAlertRuleProvisioner struct {
	logger               log.Logger
	folderService        folder.Service
	dashboardProvService dashboards.DashboardProvisioningService
	ruleService          provisioning.AlertRuleService
}

func (prov *defaultAlertRuleProvisioner) Provision(ctx context.Context,
	files []*AlertingFile) error {
	for _, file := range files {
		for _, group := range file.Groups {
			ctx, u := identity.WithServiceIdentity(ctx, group.OrgID)

			folderUID, err := prov.getOrCreateFolderFullpath(ctx, group.FolderFullpath, group.OrgID)
			if err != nil {
				prov.logger.Error("failed to get or create folder", "folder", group.FolderFullpath, "org", group.OrgID, "err", err)
				return err
			}
			prov.logger.Debug("provisioning alert rule group",
				"org", group.OrgID,
				"folder", group.FolderFullpath,
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

func (prov *defaultAlertRuleProvisioner) getOrCreateFolderFullpath(
	ctx context.Context, folderFullpath string, orgID int64) (string, error) {
	folderTitles := folderimpl.SplitFullpath(folderFullpath)
	if len(folderTitles) == 0 {
		return "", fmt.Errorf("invalid folder fullpath: %s", folderFullpath)
	}

	var folderUID *string
	for i := range folderTitles {
		uid, err := prov.getOrCreateFolderByTitle(ctx, folderTitles[i], orgID, folderUID)
		if err != nil {
			prov.logger.Error("failed to get or create folder", "folder", folderTitles[i], "org", orgID, "err", err)
			return "", err
		}
		folderUID = &uid
	}
	return *folderUID, nil
}

func (prov *defaultAlertRuleProvisioner) getOrCreateFolderByTitle(
	ctx context.Context, folderName string, orgID int64, parentUID *string) (string, error) {
	ctx, user := identity.WithServiceIdentity(ctx, orgID)

	cmd := &folder.GetFolderQuery{
		Title:        &folderName,
		ParentUID:    parentUID,
		OrgID:        orgID,
		SignedInUser: user,
	}

	cmdResult, err := prov.folderService.Get(ctx, cmd)
	if err != nil && !errors.Is(err, dashboards.ErrFolderNotFound) {
		return "", err
	}

	// dashboard folder not found. create one.
	if errors.Is(err, dashboards.ErrFolderNotFound) {
		createCmd := &folder.CreateFolderCommand{
			OrgID: orgID,
			UID:   util.GenerateShortUID(),
			Title: folderName,
		}

		if parentUID != nil {
			createCmd.ParentUID = *parentUID
		}

		f, err := prov.dashboardProvService.SaveFolderForProvisionedDashboards(ctx, createCmd)
		if err != nil {
			return "", err
		}

		return f.UID, nil
	}

	return cmdResult.UID, nil
}

var provisionerUser = func(orgID int64) identity.Requester {
	// this user has 0 ID and therefore, organization wide quota will be applied
	return accesscontrol.BackgroundUser(
		"alert_provisioner",
		orgID,
		org.RoleAdmin,
		[]accesscontrol.Permission{
			{Action: dashboards.ActionFoldersRead, Scope: dashboards.ScopeFoldersAll},
			{Action: accesscontrol.ActionAlertingProvisioningReadSecrets, Scope: dashboards.ScopeFoldersAll},
			{Action: accesscontrol.ActionAlertingProvisioningWrite, Scope: dashboards.ScopeFoldersAll},
		},
	)
}
