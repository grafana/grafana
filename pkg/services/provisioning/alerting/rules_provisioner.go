package alerting

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/dashboards"
	"github.com/grafana/grafana/pkg/util"
)

type AlertRuleProvisioner interface {
	Provision(ctx context.Context, path string) error
}

func NewAlertRuleProvisioner(
	logger log.Logger,
	dashboardService dashboards.DashboardService,
	dashboardProvService dashboards.DashboardProvisioningService) AlertRuleProvisioner {
	return &DefaultAlertRuleProvisioner{
		logger:               logger,
		cfgReader:            NewRulesConfigReader(logger),
		dashboardService:     dashboardService,
		dashboardProvService: dashboardProvService,
	}
}

type DefaultAlertRuleProvisioner struct {
	logger               log.Logger
	cfgReader            rulesConfigReader
	dashboardService     dashboards.DashboardService
	dashboardProvService dashboards.DashboardProvisioningService
}

func (prov *DefaultAlertRuleProvisioner) Provision(ctx context.Context,
	path string) error {
	prov.logger.Info("starting to provision the alert rules")
	ruleFiles, err := prov.cfgReader.readConfig(ctx, path)
	if err != nil {
		return fmt.Errorf("failed to read alert rules files: %w", err)
	}
	prov.logger.Info("read all alert rules files", "file_count", len(ruleFiles))
	err = prov.provsionRuleFiles(ctx, ruleFiles)
	if err != nil {
		return fmt.Errorf("failed to provision alert rules: %w", err)
	}
	prov.logger.Info("finished to provision the alert rules")
	return nil
}

func (prov *DefaultAlertRuleProvisioner) provsionRuleFiles(ctx context.Context,
	ruleFiles []*RuleFileV1) error {
	for _, file := range ruleFiles {
		for _, group := range file.Groups {
			folderUID, err := prov.getOrCreateFolderUID(ctx, group.Folder.Raw, group.OrgID.Value())
			if err != nil {
				return err
			}
			prov.logger.Info("provisioning alert rule group", "org", group.OrgID.Value(), "folder", group.Folder.Value(), "folderUID", folderUID, "name", group.Name.Value())
			for _, rule := range group.Rules {
				prov.logger.Info("provisioning alert rule", "uid", rule.UID.Value(), "title", rule.Title.Value())
			}
		}
	}
	return nil
}

func (prov *DefaultAlertRuleProvisioner) getOrCreateFolderUID(
	ctx context.Context, folderName string, orgID int64) (string, error) {
	//TODO: move to DTO
	if orgID == 0 {
		orgID = 1
	}
	if folderName == "" {
		return "", errors.New("missing folder name")
	}

	cmd := &models.GetDashboardQuery{Slug: models.SlugifyTitle(folderName), OrgId: orgID}
	err := prov.dashboardService.GetDashboard(ctx, cmd)

	if err != nil && !errors.Is(err, models.ErrDashboardNotFound) {
		return "", err
	}

	// dashboard folder not found. create one.
	if errors.Is(err, models.ErrDashboardNotFound) {
		dash := &dashboards.SaveDashboardDTO{}
		dash.Dashboard = models.NewDashboardFolder(folderName)
		dash.Dashboard.IsFolder = true
		dash.Overwrite = true
		dash.OrgId = orgID
		dash.Dashboard.SetUid(util.GenerateShortUID())
		dbDash, err := prov.dashboardProvService.SaveFolderForProvisionedDashboards(ctx, dash)
		if err != nil {
			return "", err
		}

		return dbDash.Uid, nil
	}

	if !cmd.Result.IsFolder {
		return "", fmt.Errorf("got invalid response. expected folder, found dashboard")
	}

	return cmd.Result.Uid, nil

}
