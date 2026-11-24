package alerting

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/folderimpl"
	alert_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleProvisioner interface {
	Provision(ctx context.Context, files []*AlertingFile) error
}

// RuleService is the subset of provisioning.AlertRuleService used by the
// alert rule file provisioner.
type RuleService interface {
	GetAlertRule(ctx context.Context, user identity.Requester, ruleUID string) (alert_models.AlertRule, utils.ManagerProperties, error)
	CreateAlertRule(ctx context.Context, user identity.Requester, rule alert_models.AlertRule, manager utils.ManagerProperties) (alert_models.AlertRule, error)
	UpdateAlertRule(ctx context.Context, user identity.Requester, rule alert_models.AlertRule, manager utils.ManagerProperties) (alert_models.AlertRule, error)
	UpdateRuleGroup(ctx context.Context, user identity.Requester, namespaceUID string, ruleGroup string, intervalSeconds int64) error
	DeleteAlertRule(ctx context.Context, user identity.Requester, ruleUID string, manager utils.ManagerProperties) error
}

// maxProvisionRetries bounds how often an operation is retried after an
// optimistic-lock conflict.
const maxProvisionRetries = 3

func NewAlertRuleProvisioner(
	logger log.Logger,
	folderService folder.Service,
	dashboardProvService dashboards.DashboardProvisioningService,
	ruleService RuleService) AlertRuleProvisioner {
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
	ruleService          RuleService
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
				err = prov.retryOnOptimisticLock(func() error {
					return prov.provisionRule(ctx, u, rule)
				})
				if err != nil {
					return err
				}
			}
			err = prov.retryOnOptimisticLock(func() error {
				return prov.ruleService.UpdateRuleGroup(ctx, u, folderUID, group.Title, group.Interval)
			})
			if err != nil {
				return err
			}
		}
		for _, deleteRule := range file.DeleteRules {
			err := prov.retryOnOptimisticLock(func() error {
				return prov.ruleService.DeleteAlertRule(ctx, provisionerUser(deleteRule.OrgID), deleteRule.UID, alert_models.ProvenanceToManagerProperties(alert_models.ProvenanceFile))
			})
			if err != nil {
				return err
			}
		}
	}
	return nil
}

// retryOnOptimisticLock re-runs fn when it fails with an optimistic-lock
// conflict. Concurrent provisioning runs (e.g. reload calls from several HA
// replicas) race on the version of the same alert rules; file provisioning is
// declarative, so re-running the operation after the other run committed
// converges to the same state.
func (prov *defaultAlertRuleProvisioner) retryOnOptimisticLock(fn func() error) error {
	var err error
	for attempt := 0; attempt < maxProvisionRetries; attempt++ {
		if err = fn(); !errors.Is(err, rulestore.ErrOptimisticLock) {
			break
		}
		prov.logger.Info("retrying provisioning operation after optimistic lock conflict", "attempt", attempt+1)
	}
	return err
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
		_, err = prov.ruleService.CreateAlertRule(ctx, user, rule, alert_models.ProvenanceToManagerProperties(alert_models.ProvenanceFile))
	} else {
		prov.logger.Debug("updating rule", "uid", rule.UID, "org", rule.OrgID)
		_, err = prov.ruleService.UpdateAlertRule(ctx, user, rule, alert_models.ProvenanceToManagerProperties(alert_models.ProvenanceFile))
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

		f, err := prov.dashboardProvService.SaveFolderForProvisionedDashboards(ctx, createCmd, "")
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
			{Action: folder.ActionFoldersRead, Scope: folder.ScopeFoldersAll},
			{Action: accesscontrol.ActionAlertingProvisioningReadSecrets},
			{Action: accesscontrol.ActionAlertingProvisioningWrite},
			{Action: accesscontrol.ActionAlertingReceiversCreate},
			{Action: accesscontrol.ActionAlertingReceiversRead, Scope: alert_models.ScopeReceiversAll},
			{Action: accesscontrol.ActionAlertingReceiversUpdate, Scope: alert_models.ScopeReceiversAll},
			{Action: accesscontrol.ActionAlertingReceiversDelete, Scope: alert_models.ScopeReceiversAll},
			// Required for updating protected fields in contact points
			{Action: accesscontrol.ActionAlertingReceiversUpdateProtected, Scope: alert_models.ScopeReceiversAll},
		},
	)
}
