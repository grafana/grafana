import { useMemo } from 'react';

import { Button, Dropdown, Icon, LinkButton, Menu, Stack } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

import { AlertingPageWrapper } from '../components/AlertingPageWrapper';
import RulesFilter from '../components/rules/Filter/RulesFilter';
import { SupportedView } from '../components/rules/Filter/RulesViewModeSelector';
import { AlertingAction, useAlertingAbility } from '../hooks/useAbilities';
import { useRulesFilter } from '../hooks/useFilteredRules';
import { useURLSearchParams } from '../hooks/useURLSearchParams';

import { FilterView } from './FilterView';
import { GroupedView } from './GroupedView';
import { RuleListPageTitle } from './RuleListPageTitle';

function RuleList() {
  const [queryParams] = useURLSearchParams();
  const { filterState, hasActiveFilters } = useRulesFilter();

  const view: SupportedView = queryParams.get('view') === 'list' ? 'list' : 'grouped';
  const showListView = hasActiveFilters || view === 'list';

  return (
    <>
      <RulesFilter onClear={() => {}} />
      {showListView ? <FilterView filterState={filterState} /> : <GroupedView />}
    </>
  );
}

export function RuleListActions() {
  const [createGrafanaRuleSupported, createGrafanaRuleAllowed] = useAlertingAbility(AlertingAction.CreateAlertRule);
  const [createCloudRuleSupported, createCloudRuleAllowed] = useAlertingAbility(AlertingAction.CreateExternalAlertRule);

  const canCreateGrafanaRules = createGrafanaRuleSupported && createGrafanaRuleAllowed;
  const canCreateCloudRules = createCloudRuleSupported && createCloudRuleAllowed;

  const canCreateRules = canCreateGrafanaRules || canCreateCloudRules;

  const moreActionsMenu = useMemo(
    () => (
      <Menu>
        <Menu.Group>
          <Menu.Item
            label={t('alerting.rule-list.draft-new-rule', 'Draft a new rule')}
            icon="file-export"
            url="/alerting/export-new-rule"
          />
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
    [canCreateGrafanaRules, canCreateCloudRules]
  );

  return (
    <Stack direction="row" gap={1}>
      {canCreateRules && (
        <LinkButton variant="primary" icon="plus" href="/alerting/new/alerting">
          <Trans i18nKey="alerting.rule-list.new-alert-rule">New alert rule</Trans>
        </LinkButton>
      )}
      <Dropdown overlay={moreActionsMenu}>
        <Button variant="secondary">
          <Trans i18nKey="alerting.rule-list.more">More</Trans> <Icon name="angle-down" />
        </Button>
      </Dropdown>
    </Stack>
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
