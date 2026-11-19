import { ContactPointSelector } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';
import { Box, Divider, Stack } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { isGranted } from '../../hooks/abilities/abilityUtils';
import { useGlobalContactPointAbility } from '../../hooks/abilities/alertmanager/useContactPointAbility';
import { ContactPointAction } from '../../hooks/abilities/types';
import { FieldLabelWithTooltip, SidebarField, SidebarSection } from '../../rule-list/filter/RulesFilterSidebar';
import {
  ChoiceFilter,
  DataSourceFilter,
  FolderFilter,
  HealthFilter,
  PluginRulesFilter,
  PolicyFilter,
  TextFilter,
} from '../rule-search/FilterSidebar';
import { LabelMatchersFilter } from '../rule-search/LabelMatchersFilter';
import { setFilters } from '../rule-search/setFilterValues';
import { formatLabelMatcher } from '../rule-search/sharedFilters';

import { type AlertFilterKey, type AlertRuleFilter, alertRuleSearchSchema } from './alertRuleFilters';

interface AlertRulesFilterSidebarProps {
  query: string;
  filter: AlertRuleFilter;
  onApply: (query: string) => void;
}

/**
 * Each control rewrites only its own filter's tokens in the query, so the rest stays as the user typed it.
 * Every control applies at once, except text, on blur or Enter. Clearing them all is the search input's Clear button.
 */
export function AlertRulesFilterSidebar({ query, filter, onApply }: AlertRulesFilterSidebarProps) {
  const canViewContactPoints = isGranted(useGlobalContactPointAbility(ContactPointAction.View));
  const apply = (changes: Partial<Record<AlertFilterKey, Array<string | undefined>>>) =>
    onApply(setFilters(query, alertRuleSearchSchema, changes));

  return (
    <Box width={32} shrink={0} paddingBottom={2}>
      <Stack direction="column" gap={2}>
        <SidebarSection>
          <TextFilter
            label={t('alerting.gma-rule-list.sidebar.rule-name', 'Rule name')}
            placeholder={t('alerting.gma-rule-list.sidebar.rule-name-placeholder', 'Filter by name')}
            value={filter.text.join(' ')}
            onApply={(text) => apply({ rule: [text] })}
          />
          <LabelMatchersFilter
            labels={filter.labels}
            onChange={(labels) => apply({ label: labels.map(formatLabelMatcher) })}
          />
          <ChoiceFilter
            label={t('alerting.gma-rule-list.sidebar.state', 'Alert state')}
            value={filter.state}
            onChange={(state) => apply({ state: [state] })}
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
          <FolderFilter folderUids={filter.folders} onChange={(uids) => apply({ folder: uids })} />
          <DataSourceFilter dataSourceUids={filter.dataSourceUids} onChange={(uids) => apply({ datasource: uids })} />
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
                onChange={(contactPoint) => apply({ contactPoint: [contactPoint?.spec.title] })}
              />
            </SidebarField>
          )}
          <PolicyFilter
            policy={filter.policy}
            disabled={Boolean(filter.contactPoint) && !filter.policy}
            onChange={(policy) => apply({ policy: [policy] })}
          />
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
              // A panel ID means nothing outside its dashboard.
              onChange={(dashboard) => apply({ dashboard: [dashboard?.uid], panelId: [] })}
            />
          </SidebarField>
          {(filter.dashboardUid || filter.panelId) && (
            <TextFilter
              label={t('alerting.gma-rule-list.sidebar.panel-id', 'Panel ID')}
              value={filter.panelId ?? ''}
              onApply={(panelId) => apply({ panelId: [panelId.trim()] })}
            />
          )}
        </SidebarSection>
        <Divider spacing={0} />
        <SidebarSection>
          <HealthFilter health={filter.health} onChange={(health) => apply({ health: [health] })} />
          <ChoiceFilter
            label={t('alerting.gma-rule-list.sidebar.paused', 'Paused')}
            value={filter.paused}
            onChange={(paused) => apply({ paused: [paused] })}
            options={[{ label: t('alerting.gma-rule-list.sidebar.paused-true', 'Paused'), value: 'true' }]}
          />
        </SidebarSection>
        <Divider spacing={0} />
        <PluginRulesFilter
          hide={filter.hidePluginRules}
          onChange={(hide) => apply({ plugins: [hide ? 'hide' : undefined] })}
        />
      </Stack>
    </Box>
  );
}
