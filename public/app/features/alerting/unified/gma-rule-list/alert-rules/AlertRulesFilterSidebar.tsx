import { useId } from 'react';

import { ContactPointSelector, RoutingTreeSelector } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Divider } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useGlobalContactPointAbility } from '../../hooks/abilities/alertmanager/useContactPointAbility';
import { ContactPointAction } from '../../hooks/abilities/types';
import {
  FieldLabelWithTooltip,
  SidebarField,
  SidebarSection,
  ToggleButtonGroup,
} from '../../rule-list/filter/RulesFilterSidebar';
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
  const pluginsLabelId = useId();

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
      <SidebarSection>
        <TextFilter
          label={t('alerting.gma-rule-list.sidebar.rule-name', 'Rule name')}
          placeholder={t('alerting.gma-rule-list.sidebar.rule-name-placeholder', 'Filter by name')}
          value={filter.text.join(' ')}
          onApply={(text) => apply('rule', [text])}
        />
        <LabelMatchersFilter
          labels={filter.labels}
          onChange={(labels) => apply('label', labels.map(formatLabelMatcher))}
        />
        <ChoiceFilter
          label={t('alerting.gma-rule-list.sidebar.state', 'Alert state')}
          value={filter.state}
          onChange={(state) => apply('state', [state])}
          options={[
            {
              label: t('alerting.gma-rule-list.sidebar.state-firing', 'Firing'),
              value: 'firing',
              icon: 'exclamation-circle',
              color: 'error',
            },
            {
              label: t('alerting.gma-rule-list.sidebar.state-pending', 'Pending'),
              value: 'pending',
              icon: 'circle',
              color: 'warning',
            },
            {
              label: t('alerting.gma-rule-list.sidebar.state-recovering', 'Recovering'),
              value: 'recovering',
              icon: 'arrow-up',
              color: 'info',
            },
            {
              label: t('alerting.gma-rule-list.sidebar.state-normal', 'Normal'),
              value: 'normal',
              icon: 'check-circle',
              color: 'success',
            },
          ]}
        />
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarSection>
        <FolderFilter folderUids={filter.folders} onChange={(uids) => apply('folder', uids)} />
        <DataSourceFilter uids={filter.dataSourceUids} onChange={(uids) => apply('datasource', uids)} />
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarSection>
        {canViewContactPoints && (
          <SidebarField
            label={
              <FieldLabelWithTooltip
                label={t('alerting.gma-rule-list.sidebar.contact-point', 'Contact point')}
                tooltip={t(
                  'alerting.gma-rule-list.sidebar.contact-point-description',
                  'Rules that route straight to it, not through a notification policy'
                )}
                tooltipTitle={t('alerting.gma-rule-list.sidebar.contact-point-help', 'Contact point filter help')}
              />
            }
          >
            <ContactPointSelector
              placeholder={t('alerting.gma-rule-list.sidebar.contact-point-placeholder', 'Select contact point')}
              value={filter.contactPoint}
              isClearable
              disabled={Boolean(filter.policy) && !filter.contactPoint}
              onChange={(contactPoint) => apply('contactPoint', [contactPoint?.spec.title])}
            />
          </SidebarField>
        )}
        <SidebarField
          label={
            <FieldLabelWithTooltip
              label={t('alerting.gma-rule-list.sidebar.policy', 'Notification policy')}
              tooltip={t(
                'alerting.gma-rule-list.sidebar.policy-description',
                'Rules routed through it, not straight to a contact point'
              )}
              tooltipTitle={t('alerting.gma-rule-list.sidebar.policy-help', 'Notification policy filter help')}
            />
          }
        >
          <RoutingTreeSelector
            placeholder={t('alerting.gma-rule-list.sidebar.policy-placeholder', 'Select policy')}
            // The selector reads an empty name as the default tree.
            value={filter.policy === DEFAULT_POLICY ? '' : filter.policy}
            isClearable
            disabled={Boolean(filter.contactPoint) && !filter.policy}
            onChange={(tree) => apply('policy', [tree?.metadata.name])}
          />
        </SidebarField>
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarSection>
        <SidebarField label={t('alerting.gma-rule-list.sidebar.dashboard', 'Dashboard')}>
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
        </SidebarField>
        {(filter.dashboardUid || filter.panelId) && (
          <TextFilter
            label={t('alerting.gma-rule-list.sidebar.panel-id', 'Panel ID')}
            value={filter.panelId ?? ''}
            onApply={(panelId) => apply('panelId', [panelId.trim()])}
          />
        )}
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarSection>
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
        <ChoiceFilter
          label={t('alerting.gma-rule-list.sidebar.paused', 'Paused')}
          value={filter.paused}
          onChange={(paused) => apply('paused', [paused])}
          options={[
            { label: t('alerting.gma-rule-list.sidebar.paused-true', 'Paused'), value: 'true' },
            { label: t('alerting.gma-rule-list.sidebar.paused-false', 'Not paused'), value: 'false' },
          ]}
        />
      </SidebarSection>
      <Divider spacing={0} />
      <SidebarField label={t('alerting.gma-rule-list.sidebar.plugin-rules', 'Plugin rules')} labelId={pluginsLabelId}>
        <ToggleButtonGroup<boolean>
          aria-labelledby={pluginsLabelId}
          value={filter.hidePluginRules}
          onChange={(hide) => apply('plugins', [hide ? 'hide' : undefined])}
          options={[
            { label: t('alerting.gma-rule-list.sidebar.plugin-rules-show', 'Show'), value: false },
            { label: t('alerting.gma-rule-list.sidebar.plugin-rules-hide', 'Hide'), value: true },
          ]}
        />
      </SidebarField>
    </FilterSidebar>
  );
}
