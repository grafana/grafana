import { ContactPointSelector, RoutingTreeSelector } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { Trans, t } from '@grafana/i18n';
import { Button, Combobox, type ComboboxOption, Input, Stack, Tooltip } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { type Criteria, DEFAULT_POLICY, type StateValue } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
import {
  FilterSidebarContainer,
  HealthField,
  InvalidTokenNote,
  LabelMatchersEditor,
  PendingFilterNote,
  RuleTitleField,
  SidebarField,
  SidebarSection,
  SwitchField,
} from '../rule-search/filterSidebarPrimitives';
import { DataSourceMultiFilter, FolderMultiFilter } from '../rule-search/multiValueFilters';

type PausedValue = 'any' | 'true' | 'false';

function getPausedOptions(): Array<ComboboxOption<PausedValue>> {
  return [
    { label: t('alerting.gma-rule-list.search.paused-any', 'Any'), value: 'any' },
    { label: t('alerting.gma-rule-list.search.paused-true', 'Paused'), value: 'true' },
    { label: t('alerting.gma-rule-list.search.paused-false', 'Not paused'), value: 'false' },
  ];
}

type StateOption = StateValue | 'any';

function getStateOptions(): Array<ComboboxOption<StateOption>> {
  return [
    { label: t('alerting.gma-rule-list.search.state-any', 'Any'), value: 'any' },
    { label: t('alerting.gma-rule-list.search.state-firing', 'Firing'), value: 'firing' },
    { label: t('alerting.gma-rule-list.search.state-pending', 'Pending'), value: 'pending' },
    { label: t('alerting.gma-rule-list.search.state-recovering', 'Recovering'), value: 'recovering' },
    { label: t('alerting.gma-rule-list.search.state-normal', 'Normal'), value: 'normal' },
  ];
}

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
export function AlertRulesFilterSidebar({
  criteria,
  onChange,
  onClear,
  hasActiveFilters,
  issues = [],
}: AlertRulesFilterSidebarProps) {
  const invalidNamespace = hasIssue(issues, 'namespace');
  const invalidDataSource = hasIssue(issues, 'datasource');
  const panelRequiresDashboard = issues.some(
    (issue) => issue.key === 'panelId' && issue.reason === 'requiresDashboard'
  );

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
              note={invalidNamespace && <InvalidTokenNote />}
            >
              <FolderMultiFilter
                values={criteria.namespaces}
                invalid={invalidNamespace}
                onChange={(namespaces) => onChange({ ...criteria, namespaces })}
              />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.datasource">Query data source</Trans>}
              note={invalidDataSource && <InvalidTokenNote />}
            >
              <DataSourceMultiFilter
                values={criteria.dataSourceUids}
                invalid={invalidDataSource}
                onChange={(dataSourceUids) => onChange({ ...criteria, dataSourceUids })}
              />
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.plugins">Plugin rules</Trans>}>
              <SwitchField
                label={t('alerting.gma-rule-list.search.property.hide-plugin-rules', 'Hide plugin rules')}
                value={criteria.hidePluginRules}
                onChange={(hidePluginRules) => onChange({ ...criteria, hidePluginRules })}
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.dashboard">Dashboard</Trans>}>
              <DashboardPicker
                aria-label={t('alerting.gma-rule-list.search.property.dashboard', 'Dashboard')}
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
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.contact-point">Contact point</Trans>}
            >
              <ContactPointSelector
                value={criteria.contactPoint}
                placeholder={t('alerting.gma-rule-list.search.contact-point-placeholder', 'Select contact point')}
                isClearable
                disabled={Boolean(criteria.policy)}
                onChange={(cp: { spec: { title: string } } | null) =>
                  onChange({ ...criteria, contactPoint: cp?.spec.title, policy: cp ? undefined : criteria.policy })
                }
              />
            </SidebarField>
            <SidebarField
              label={<Trans i18nKey="alerting.gma-rule-list.search.property.policy">Notification policy</Trans>}
            >
              <Stack direction="column" gap={0.5}>
                <RoutingTreeSelector
                  value={criteria.policy === DEFAULT_POLICY ? undefined : criteria.policy}
                  placeholder={t('alerting.gma-rule-list.search.policy-placeholder', 'Select policy')}
                  isClearable
                  disabled={Boolean(criteria.contactPoint) || criteria.policy === DEFAULT_POLICY}
                  onChange={(tree: RoutingTree | null) =>
                    onChange({
                      ...criteria,
                      policy: tree?.metadata.name,
                      contactPoint: tree ? undefined : criteria.contactPoint,
                    })
                  }
                />
                <SwitchField
                  label={t('alerting.gma-rule-list.search.property.default-policy', 'Default policy')}
                  value={criteria.policy === DEFAULT_POLICY}
                  // Filtering by the default policy isn't supported yet; the switch stays usable only
                  // to clear a value that arrived through the URL or a saved search.
                  disabled={criteria.policy !== DEFAULT_POLICY}
                  onChange={(isDefault) =>
                    onChange({ ...criteria, policy: isDefault ? DEFAULT_POLICY : undefined, contactPoint: undefined })
                  }
                />
                <PendingFilterNote />
              </Stack>
            </SidebarField>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.paused">Paused</Trans>}>
              <Combobox<PausedValue>
                aria-label={t('alerting.gma-rule-list.search.property.paused', 'Paused')}
                options={getPausedOptions()}
                value={criteria.paused ?? 'any'}
                onChange={(option: ComboboxOption<PausedValue> | null) =>
                  onChange({ ...criteria, paused: !option || option.value === 'any' ? undefined : option.value })
                }
              />
            </SidebarField>
          </SidebarSection>

          <SidebarSection>
            <SidebarField label={<Trans i18nKey="alerting.gma-rule-list.search.property.state">Alert state</Trans>}>
              <Combobox<StateOption>
                aria-label={t('alerting.gma-rule-list.search.property.state', 'Alert state')}
                options={getStateOptions()}
                // `inactive` is an accepted spelling of `normal`; both select the same option.
                value={criteria.state === 'inactive' ? 'normal' : (criteria.state ?? 'any')}
                onChange={(option) =>
                  onChange({ ...criteria, state: !option || option.value === 'any' ? undefined : option.value })
                }
              />
            </SidebarField>
            <HealthField value={criteria.health} onChange={(health) => onChange({ ...criteria, health })} />
          </SidebarSection>
        </Stack>
      </Stack>
    </FilterSidebarContainer>
  );
}

function hasIssue(issues: CriteriaIssue[], key: string): boolean {
  return issues.some((issue) => issue.key === key);
}
