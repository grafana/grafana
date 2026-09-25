import { ContactPointSelector, RoutingTreeSelector } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { type DataSourceInstanceSettings } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DataSourcePicker } from '@grafana/runtime';
import { Button, Input, RadioButtonGroup, Stack, Switch, Tooltip } from '@grafana/ui';
import { NestedFolderPicker } from 'app/core/components/NestedFolderPicker/NestedFolderPicker';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { type CriteriaIssue } from './criteriaIssues';
import {
  FilterSidebarContainer,
  InvalidTokenNote,
  LabelMatchersEditor,
  PendingFilterNote,
  RuleTitleField,
  SidebarField,
  SidebarSection,
} from './filterSidebarPrimitives';
import { type Criteria } from './types';

export interface AlertRulesFilterSidebarProps {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  issues?: CriteriaIssue[];
}

/**
 * Persistent filter sidebar for the Alert rules page. Every control applies immediately
 * (matching the current search input's rule-title-on-blur/Enter exception) and edits the
 * same criteria/URL as the search input — there is no separate sidebar state.
 */
export function AlertRulesFilterSidebar({ criteria, onChange, onClear, hasActiveFilters, issues = [] }: AlertRulesFilterSidebarProps) {
  const unresolvedNamespace = issues.some((issue) => issue.key === 'namespace' && issue.reason === 'unresolved');
  const unresolvedDataSource = issues.some((issue) => issue.key === 'datasource' && issue.reason === 'unresolved');
  const panelRequiresDashboard = issues.some((issue) => issue.key === 'panelId' && issue.reason === 'requiresDashboard');

  return (
    <FilterSidebarContainer>
      <Stack direction="column" gap={0}>
        <Stack direction="row" justifyContent="flex-end">
          <Button size="sm" variant="primary" fill="text" onClick={onClear} disabled={!hasActiveFilters}>
            <Trans i18nKey="alerting.gma-rule-list.search.clear-filters">Clear filters</Trans>
          </Button>
        </Stack>
        <Stack direction="column" gap={2}>
          <SidebarSection>
            <RuleTitleField criteria={criteria} onChange={onChange} />
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.labels">Labels</Trans>}>
              <LabelMatchersEditor labels={criteria.labels} onChange={(labels) => onChange({ ...criteria, labels })} />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.folder">Folder</Trans>}
              note={unresolvedNamespace && <InvalidTokenNote />}
            >
              <NestedFolderPicker
                value={criteria.namespaces[0]}
                invalid={unresolvedNamespace}
                permission="view"
                clearable
                onChange={(uid) => onChange({ ...criteria, namespaces: uid ? [uid] : [] })}
              />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.datasource">Query data source</Trans>}
              note={unresolvedDataSource && <InvalidTokenNote />}
            >
              <DataSourcePicker
                current={criteria.dataSourceUids[0]}
                onChange={(ds: DataSourceInstanceSettings) => onChange({ ...criteria, dataSourceUids: [ds.uid] })}
              />
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.plugins">Plugin rules</Trans>}>
              <Switch
                label={t('alerting.gma-rule-list.search.property.hide-plugin-rules', 'Hide plugin rules')}
                value={criteria.hidePluginRules}
                onChange={(e) => onChange({ ...criteria, hidePluginRules: e.currentTarget.checked })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.dashboard">Dashboard</Trans>}>
              <DashboardPicker
                value={criteria.dashboardUid}
                onChange={(dashboard) =>
                  onChange({
                    ...criteria,
                    dashboardUid: dashboard?.uid,
                    // Panel IDs are dashboard-local — clearing the dashboard clears the panel too.
                    panelId: dashboard?.uid ? criteria.panelId : undefined,
                  })
                }
              />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.panel">Panel ID</Trans>}
              note={panelRequiresDashboard && <InvalidTokenNote />}
            >
              <Tooltip
                content={t(
                  'alerting.gma-rule-list.search.property.panel-requires-dashboard',
                  'Panel ID needs a dashboard selected above — panel IDs are dashboard-local.'
                )}
              >
                <Input
                  aria-label={t('alerting.gma-rule-list.search.property.panel', 'Panel ID')}
                  type="number"
                  disabled={!criteria.dashboardUid}
                  invalid={panelRequiresDashboard}
                  value={criteria.panelId ?? ''}
                  onChange={(e) => onChange({ ...criteria, panelId: e.currentTarget.value || undefined })}
                />
              </Tooltip>
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.contact-point">Contact point</Trans>}>
              <ContactPointSelector
                value={criteria.contactPoint}
                isClearable
                disabled={Boolean(criteria.policy)}
                onChange={(cp: { spec: { title: string } } | null) =>
                  onChange({ ...criteria, contactPoint: cp?.spec.title, policy: cp ? undefined : criteria.policy })
                }
              />
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.policy">Notification policy</Trans>}>
              <Stack direction="column" gap={0.5}>
                <RoutingTreeSelector
                  value={criteria.policy === 'default' ? undefined : criteria.policy}
                  isClearable
                  disabled={Boolean(criteria.contactPoint) || criteria.policy === 'default'}
                  onChange={(tree: RoutingTree | null) =>
                    onChange({ ...criteria, policy: tree?.metadata.name, contactPoint: tree ? undefined : criteria.contactPoint })
                  }
                />
                <Switch
                  label={t('alerting.gma-rule-list.search.property.default-policy', 'Default policy')}
                  value={criteria.policy === 'default'}
                  disabled={Boolean(criteria.contactPoint)}
                  onChange={(e) =>
                    onChange({ ...criteria, policy: e.currentTarget.checked ? 'default' : undefined, contactPoint: undefined })
                  }
                />
              </Stack>
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.paused">Paused</Trans>}>
              <RadioButtonGroup<'any' | 'true' | 'false'>
                options={[
                  { label: t('alerting.gma-rule-list.search.paused-any', 'Any'), value: 'any' },
                  { label: t('alerting.gma-rule-list.search.paused-true', 'Paused'), value: 'true' },
                  { label: t('alerting.gma-rule-list.search.paused-false', 'Not paused'), value: 'false' },
                ]}
                value={criteria.paused ?? 'any'}
                onChange={(value) => onChange({ ...criteria, paused: value === 'any' ? undefined : value })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.state">Alert state</Trans>}
              note={<PendingFilterNote />}
            >
              <Input disabled placeholder={t('alerting.gma-rule-list.search.property.state-placeholder', 'Not available yet')} />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.health">Health</Trans>}
              note={<PendingFilterNote />}
            >
              <Input disabled placeholder={t('alerting.gma-rule-list.search.property.health-placeholder', 'Not available yet')} />
            </SidebarField>
          </SidebarSection>
        </Stack>
      </Stack>
    </FilterSidebarContainer>
  );
}
