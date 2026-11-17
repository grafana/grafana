import { ContactPointSelector, RoutingTreeSelector } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Checkbox, Field } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useGlobalContactPointAbility } from '../../hooks/abilities/alertmanager/useContactPointAbility';
import { ContactPointAction } from '../../hooks/abilities/types';
import { ChoiceFilter, DataSourceFilter, FilterSidebar, FolderFilter, TextFilter } from '../rule-search/FilterSidebar';
import { LabelMatchersFilter } from '../rule-search/LabelMatchersFilter';
import { setFilterValues } from '../rule-search/setFilterValues';
import { formatLabelMatcher } from '../rule-search/sharedFilters';

import { type AlertFilterKey, type AlertRuleFilter, DEFAULT_POLICY, alertRuleSearchSchema } from './alertRuleFilters';

interface AlertRulesFilterSidebarProps {
  query: string;
  filter: AlertRuleFilter;
  onApply: (query: string) => void;
}

/** Each control rewrites only its own filter's tokens in the query, so the rest stays as the user typed it. */
export function AlertRulesFilterSidebar({ query, filter, onApply }: AlertRulesFilterSidebarProps) {
  const canViewContactPoints = isGranted(useGlobalContactPointAbility(ContactPointAction.View));

  const set = (key: AlertFilterKey, values: Array<string | undefined>, from = query) =>
    setFilterValues(
      from,
      alertRuleSearchSchema,
      key,
      values.filter((value) => value !== undefined)
    );
  const apply = (key: AlertFilterKey, values: Array<string | undefined>) => onApply(set(key, values));

  return (
    <FilterSidebar canClear={query.trim().length > 0} onClear={() => onApply('')}>
      <TextFilter
        label={t('alerting.gma-rule-list.sidebar.rule-name', 'Rule name')}
        placeholder={t('alerting.gma-rule-list.sidebar.rule-name-placeholder', 'Filter by name')}
        value={filter.text.join(' ')}
        onApply={(text) => apply('rule', [text])}
      />
      <FolderFilter folderUids={filter.folders} onChange={(uids) => apply('folder', uids)} />
      <LabelMatchersFilter
        labels={filter.labels}
        onChange={(labels) => apply('label', labels.map(formatLabelMatcher))}
      />
      <ChoiceFilter
        label={t('alerting.gma-rule-list.sidebar.state', 'Alert state')}
        value={filter.state}
        onChange={(state) => apply('state', [state])}
        options={[
          { label: t('alerting.gma-rule-list.sidebar.state-firing', 'Firing'), value: 'firing' },
          { label: t('alerting.gma-rule-list.sidebar.state-pending', 'Pending'), value: 'pending' },
          { label: t('alerting.gma-rule-list.sidebar.state-recovering', 'Recovering'), value: 'recovering' },
          { label: t('alerting.gma-rule-list.sidebar.state-normal', 'Normal'), value: 'normal' },
        ]}
      />
      <ChoiceFilter
        label={t('alerting.gma-rule-list.sidebar.health', 'Health')}
        value={filter.health}
        onChange={(health) => apply('health', [health])}
        options={[
          { label: t('alerting.gma-rule-list.sidebar.health-ok', 'OK'), value: 'ok' },
          { label: t('alerting.gma-rule-list.sidebar.health-nodata', 'No data'), value: 'nodata' },
          { label: t('alerting.gma-rule-list.sidebar.health-error', 'Error'), value: 'error' },
          { label: t('alerting.gma-rule-list.sidebar.health-unknown', 'Unknown'), value: 'unknown' },
        ]}
      />
      {canViewContactPoints && (
        <Field
          noMargin
          label={t('alerting.gma-rule-list.sidebar.contact-point', 'Contact point')}
          description={t(
            'alerting.gma-rule-list.sidebar.contact-point-description',
            'Rules that route straight to it, not through a notification policy'
          )}
        >
          <ContactPointSelector
            value={filter.contactPoint}
            isClearable
            disabled={Boolean(filter.policy) && !filter.contactPoint}
            onChange={(contactPoint) => apply('contactPoint', [contactPoint?.spec.title])}
          />
        </Field>
      )}
      <Field
        noMargin
        label={t('alerting.gma-rule-list.sidebar.policy', 'Notification policy')}
        description={t(
          'alerting.gma-rule-list.sidebar.policy-description',
          'Rules routed through it, not straight to a contact point'
        )}
      >
        <RoutingTreeSelector
          // The selector reads an empty name as the default tree.
          value={filter.policy === DEFAULT_POLICY ? '' : filter.policy}
          isClearable
          disabled={Boolean(filter.contactPoint) && !filter.policy}
          onChange={(tree) => apply('policy', [tree?.metadata.name])}
        />
      </Field>
      <Field noMargin label={t('alerting.gma-rule-list.sidebar.dashboard', 'Dashboard')}>
        <DashboardPicker
          // The picker keeps its own selection and ignores a cleared value, so a new value remounts it.
          key={filter.dashboardUid ?? ''}
          value={filter.dashboardUid}
          isClearable
          showUnknown
          // A panel ID means nothing without its dashboard.
          onChange={(dashboard) =>
            onApply(dashboard ? set('dashboard', [dashboard.uid]) : set('panelId', [], set('dashboard', [])))
          }
        />
      </Field>
      {(filter.dashboardUid || filter.panelId) && (
        <TextFilter
          label={t('alerting.gma-rule-list.sidebar.panel-id', 'Panel ID')}
          value={filter.panelId ?? ''}
          onApply={(panelId) => apply('panelId', [panelId.trim()])}
        />
      )}
      <ChoiceFilter
        label={t('alerting.gma-rule-list.sidebar.paused', 'Paused')}
        value={filter.paused}
        onChange={(paused) => apply('paused', [paused])}
        options={[
          { label: t('alerting.gma-rule-list.sidebar.paused-true', 'Paused'), value: 'true' },
          { label: t('alerting.gma-rule-list.sidebar.paused-false', 'Not paused'), value: 'false' },
        ]}
      />
      <DataSourceFilter uids={filter.dataSourceUids} onChange={(uids) => apply('datasource', uids)} />
      <Checkbox
        label={t('alerting.gma-rule-list.sidebar.hide-plugin-rules', 'Hide plugin rules')}
        value={filter.hidePluginRules}
        onChange={(event) => apply('plugins', [event.currentTarget.checked ? 'hide' : undefined])}
      />
    </FilterSidebar>
  );
}
