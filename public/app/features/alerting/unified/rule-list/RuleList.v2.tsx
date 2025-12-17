import { useEffect, useMemo, useRef, useState } from 'react';
import { useToggle } from 'react-use';

import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';
import { AccessControlAction } from 'app/types/accessControl';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import { GrafanaRulesExporter } from '../components/export/GrafanaRulesExporter';
import { useListViewMode } from '../components/rules/Filter/RulesViewModeSelector';
import { AIAlertRuleButtonComponent } from '../enterprise-components/AI/AIGenAlertRuleButton/addAIAlertRuleButton';
import { shouldUseSavedSearches } from '../featureToggles';
import { AlertingAction, useAlertingAbility } from '../hooks/useAbilities';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { getSearchFilterFromQuery } from '../search/rulesSearchParser';

import { FilterView } from './FilterView';
import { GroupedView } from './GroupedView';
import { RuleListPageTitle } from './RuleListPageTitle';
import RulesFilter from './filter/RulesFilter';
import { UseSavedSearchesResult, useSavedSearches } from './filter/useSavedSearches';

interface RuleListProps {
  savedSearchesResult: UseSavedSearchesResult;
}

function RuleList({ savedSearchesResult }: RuleListProps) {
  const { filterState } = useRulesFilter();
  const { viewMode, handleViewChange } = useListViewMode();

  return (
    <Stack direction="column">
      <RulesFilter viewMode={viewMode} onViewModeChange={handleViewChange} savedSearchesResult={savedSearchesResult} />
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
  // Align import UI permission with convert endpoint requirements: rule create + provisioning set status
  const canImportRulesToGMA =
    config.featureToggles.alertingMigrationUI &&
    contextSrv.hasPermission(AccessControlAction.AlertingRuleCreate) &&
    contextSrv.hasPermission(AccessControlAction.AlertingProvisioningSetStatus);

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
              label={t('alerting.rule-list.export-all-grafana-rules', 'Export all Grafana rules')}
              icon="download-alt"
              onClick={toggleShowExportDrawer}
            />
          )}
          {canImportRulesToGMA && (
            <Menu.Item
              label={t('alerting.rule-list-v2.import-to-gma', 'Import alert rules')}
              icon="upload"
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
    [canCreateGrafanaRules, canCreateCloudRules, canImportRulesToGMA, canExportRules, toggleShowExportDrawer]
  );

  return (
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
      {canExportRules && showExportDrawer && <GrafanaRulesExporter onClose={toggleShowExportDrawer} />}
    </Stack>
  );
}

export default function RuleListPage() {
  const savedSearchesEnabled = shouldUseSavedSearches();
  const savedSearchesResult = useSavedSearches();
  const { updateFilters } = useRulesFilter();

  const hasAppliedRef = useRef(false);
  const [isReady, setIsReady] = useState(!savedSearchesEnabled);

  // Apply default search once after saved searches are loaded
  // This runs BEFORE RuleList mounts, preventing double API requests
  useEffect(() => {
    if (!savedSearchesEnabled || savedSearchesResult.isLoading || hasAppliedRef.current) {
      return;
    }

    hasAppliedRef.current = true;

    const defaultSearch = savedSearchesResult.getAutoApplySearch();
    if (defaultSearch) {
      updateFilters(getSearchFilterFromQuery(defaultSearch.query));
    }

    setIsReady(true);
  }, [savedSearchesEnabled, savedSearchesResult, updateFilters]);

  const isPageLoading = savedSearchesEnabled && !isReady;

  return (
    <AlertingPageWrapper
      navId="alert-list"
      renderTitle={(title) => <RuleListPageTitle title={title} />}
      isLoading={isPageLoading}
      actions={<RuleListActions />}
    >
      {!isPageLoading && <RuleList savedSearchesResult={savedSearchesResult} />}
    </AlertingPageWrapper>
  );
}
