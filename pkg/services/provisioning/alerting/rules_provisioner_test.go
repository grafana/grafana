package alerting

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	alert_models "github.com/grafana/grafana/pkg/services/ngalert/models"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
)

type fakeRuleService struct {
	rule alert_models.AlertRule

	updateCalls      int
	updateGroupCalls int
	deleteCalls      int

	updateFailures      int // remaining UpdateAlertRule calls that fail with an optimistic-lock conflict
	updateGroupFailures int // remaining UpdateRuleGroup calls that fail with an optimistic-lock conflict
	deleteFailures      int // remaining DeleteAlertRule calls that fail with an optimistic-lock conflict
}

func (f *fakeRuleService) GetAlertRule(_ context.Context, _ identity.Requester, _ string) (alert_models.AlertRule, utils.ManagerProperties, error) {
	return f.rule, utils.ManagerProperties{}, nil
}

func (f *fakeRuleService) CreateAlertRule(_ context.Context, _ identity.Requester, rule alert_models.AlertRule, _ utils.ManagerProperties) (alert_models.AlertRule, error) {
	return rule, nil
}

func (f *fakeRuleService) UpdateAlertRule(_ context.Context, _ identity.Requester, rule alert_models.AlertRule, _ utils.ManagerProperties) (alert_models.AlertRule, error) {
	f.updateCalls++
	if f.updateFailures > 0 {
		f.updateFailures--
		return alert_models.AlertRule{}, rulestore.ErrOptimisticLock
	}
	return rule, nil
}

func (f *fakeRuleService) UpdateRuleGroup(_ context.Context, _ identity.Requester, _ string, _ string, _ int64) error {
	f.updateGroupCalls++
	if f.updateGroupFailures > 0 {
		f.updateGroupFailures--
		return rulestore.ErrOptimisticLock
	}
	return nil
}

func (f *fakeRuleService) DeleteAlertRule(_ context.Context, _ identity.Requester, _ string, _ utils.ManagerProperties) error {
	f.deleteCalls++
	if f.deleteFailures > 0 {
		f.deleteFailures--
		return rulestore.ErrOptimisticLock
	}
	return nil
}

func setupRuleProvisioner(ruleService RuleService) *defaultAlertRuleProvisioner {
	folderService := foldertest.NewFakeService()
	folderService.AddFolder(&folder.Folder{UID: "folder-uid", Title: "test-folder", OrgID: 1})
	return &defaultAlertRuleProvisioner{
		logger:        log.NewNopLogger(),
		folderService: folderService,
		ruleService:   ruleService,
	}
}

func testAlertingFile() *AlertingFile {
	return &AlertingFile{
		Groups: []alert_models.AlertRuleGroupWithFolderFullpath{
			{
				AlertRuleGroup: &alert_models.AlertRuleGroup{
					Title:    "group-1",
					Interval: 60,
					Rules:    []alert_models.AlertRule{{OrgID: 1, UID: "rule-1", Title: "rule 1"}},
				},
				OrgID:          1,
				FolderFullpath: "test-folder",
			},
		},
		DeleteRules: []RuleDelete{{UID: "rule-2", OrgID: 1}},
	}
}

func TestAlertRuleProvisionerRetriesOnOptimisticLock(t *testing.T) {
	ruleService := &fakeRuleService{
		rule:           alert_models.AlertRule{OrgID: 1, UID: "rule-1", Title: "rule 1"},
		updateFailures: 1,
	}
	prov := setupRuleProvisioner(ruleService)

	err := prov.Provision(context.Background(), []*AlertingFile{testAlertingFile()})
	require.NoError(t, err)
	assert.Equal(t, 2, ruleService.updateCalls, "update should be retried after an optimistic-lock conflict")
}

func TestAlertRuleProvisionerFailsAfterMaxOptimisticLockRetries(t *testing.T) {
	ruleService := &fakeRuleService{
		rule:           alert_models.AlertRule{OrgID: 1, UID: "rule-1", Title: "rule 1"},
		updateFailures: maxProvisionRetries + 1,
	}
	prov := setupRuleProvisioner(ruleService)

	err := prov.Provision(context.Background(), []*AlertingFile{testAlertingFile()})
	require.ErrorIs(t, err, rulestore.ErrOptimisticLock)
	assert.Equal(t, maxProvisionRetries, ruleService.updateCalls, "update should be attempted maxProvisionRetries times")
}

func TestAlertRuleProvisionerRetriesRuleGroupAndDelete(t *testing.T) {
	ruleService := &fakeRuleService{
		rule:                alert_models.AlertRule{OrgID: 1, UID: "rule-1", Title: "rule 1"},
		updateGroupFailures: 1,
		deleteFailures:      1,
	}
	prov := setupRuleProvisioner(ruleService)

	err := prov.Provision(context.Background(), []*AlertingFile{testAlertingFile()})
	require.NoError(t, err)
	assert.Equal(t, 2, ruleService.updateGroupCalls, "rule group update should be retried after an optimistic-lock conflict")
	assert.Equal(t, 2, ruleService.deleteCalls, "rule delete should be retried after an optimistic-lock conflict")
}
