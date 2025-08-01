import React, { useMemo } from 'react';
import { useToggle } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { GrafanaRulesExporter } from '../components/export/GrafanaRulesExporter';
import RulesFilter from '../components/rules/Filter/RulesFilter';
import { useListViewMode } from '../components/rules/Filter/RulesViewModeSelector';
import { AIAlertRuleButtonComponent } from '../enterprise-components/AI/AIGenAlertRuleButton/addAIAlertRuleButton';
import { AlertingAction, useAlertingAbility } from '../hooks/useAbilities';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { isAdmin } from '../utils/misc';

import { FilterView } from './FilterView';
import { GroupedView } from './GroupedView';
import { RuleListPageTitle } from './RuleListPageTitle';

function RuleList() {
  const { filterState } = useRulesFilter();
  const { viewMode, handleViewChange } = useListViewMode();

  return (
    <Stack direction="column">
      <RulesFilter viewMode={viewMode} onViewModeChange={handleViewChange} />
      {viewMode === 'list' ? (
        <FilterView filterState={filterState} />
      ) : (
        <GroupedView groupFilter={filterState.groupName} namespaceFilter={filterState.namespace} />
      )}
    </Stack>
  );
}

export function RuleListActions() {
  const [createGrafanaRuleSupported, createGrafanaRuleAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertingAbility(AlertingAction.CreateExternalAlertRule);
  const [exportRulesSupported, exportRulesAllowed] = useAlertingAbility(AlertingAction.ExportGrafanaManagedRules);

  const canCreateGrafanaRules = createGrafanaRuleSupported && createGrafanaRuleAllowed;
  const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;
  const canExportRules = exportRulesSupported && exportRulesAllowed;

  const canCreateRules = canCreateGrafanaRules || canCreateCloudRules;
  const canImportRulesToGMA = isAdmin() && config.featureToggles.alertingMigrationUI;

  const [showExportDrawer, toggleShowExportDrawer] = useToggle(false);

  const moreActionsMenu = useMemo(
    () => (
      <Menu>
        <Menu.Group>
          <Menu.Item
            label={t('alerting.rule-list.new-rule-for-export', 'New alert rule for export')}
            icon="file-export"
            url="/alerting/export-new-rule"
          />
          {canExportRules && (
            <Menu.Item
              label={t('alerting.grafana-rules.export-all-grafana-rules-tooltip-export-all-grafanamanaged-rules', 'Export all Grafana-managed rules')}
              icon="download-alt"
              onClick={toggleShowExportDrawer}
            />
          )}
          {canImportRulesToGMA && (
            <Menu.Item
              label={t('alerting.rule-list-v2.import-to-gma', 'Import alert rules')}
              icon="import"
              url="/alerting/import-datasource-managed-rules"
            />
          )}
        </Menu.Group>
        <Menu.Group label={t('alerting.rule-list.recording-rules', 'Recording rules')}>
          {canCreateGrafanaRules && (
            <Menu.Item
              label={t('alerting.rule-list.new-grafana-recording-rule', 'New Grafana recording rule')}
              icon="grafana"
              url="/alerting/new/grafana-recording"
            />
          )}
          {canCreateCloudRules && (
            <Menu.Item
              label={t('alerting.rule-list.new-datasource-recording-rule', 'New Data source recording rule')}
              icon="gf-prometheus"
              url="/alerting/new/recording"
            />
          )}
        </Menu.Group>
      </Menu>
    ),
    [canCreateGrafanaRules, canCreateCloudRules, canExportRules, canImportRulesToGMA, toggleShowExportDrawer]
  );

  return (
    <React.Fragment>
      <Stack direction="row" gap={1}>
        {canCreateRules && (
          <LinkButton variant="primary" icon="plus" href="/alerting/new/alerting">
            <Trans i18nKey="alerting.rule-list.new-alert-rule">New alert rule</Trans>
          </LinkButton>
        )}
        {canCreateGrafanaRules && <AIAlertRuleButtonComponent />}
        <Dropdown overlay={moreActionsMenu}>
          <Button variant="secondary">
            <Trans i18nKey="alerting.rule-list.more">More</Trans> <Icon name="angle-down" />
          </Button>
        </Dropdown>
      </Stack>
      {canExportRules && showExportDrawer && <GrafanaRulesExporter onClose={toggleShowExportDrawer} />}
    </React.Fragment>
  );
}

export default function RuleListPage() {
  return (
    <AlertingPageWrapper
      navId="alert-list"
      renderTitle={(title) => <RuleListPageTitle title={title} />}
      isLoading={false}
      actions={<RuleListActions />}
    >
      <RuleList />
    </AlertingPageWrapper>
  );
}
