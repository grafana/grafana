import { useId } from 'react';

import { RoutingTreeSelector } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Input, Stack, Tooltip } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { FilterSidebar, type SidebarControl } from '../rule-search/FilterSidebar';
import { alertTokens } from '../rule-search/alertTokens';
import { type Criteria, DEFAULT_POLICY, type StateValue } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
import {
  HealthField,
  InvalidTokenNote,
  LabelMatchersEditor,
  RuleTitleField,
  SwitchField,
  UnavailableFilterNote,
} from '../rule-search/filterSidebarPrimitives';
import { DataSourceMultiFilter, FolderMultiFilter } from '../rule-search/multiValueFilters';
import { TOKEN_KEYS } from '../rule-search/tokens';

import { AlertContactPointFilter } from './AlertContactPointFilter';

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
  const folderPickerId = useId();
  const invalidNamespace = hasIssue(issues, 'namespace');
  const invalidDataSource = hasIssue(issues, 'datasource');
  const panelRequiresDashboard = issues.some(
    (issue) => issue.key === 'panelId' && issue.reason === 'requiresDashboard'
  );
  const defaultPolicyUnavailable = alertTokens
    .find((definition) => definition.key === TOKEN_KEYS.policy)
    ?.unavailableValues?.find((unavailable) => unavailable.value === DEFAULT_POLICY);

  const controls: Record<string, SidebarControl> = {
    [TOKEN_KEYS.rule]: { render: () => <RuleTitleField criteria={criteria} onChange={onChange} /> },
    [TOKEN_KEYS.label]: {
      render: () => (
        <LabelMatchersEditor labels={criteria.labels} onChange={(labels) => onChange({ ...criteria, labels })} />
      ),
    },
    [TOKEN_KEYS.namespace]: {
      controlId: folderPickerId,
      note: invalidNamespace && <InvalidTokenNote />,
      render: () => (
        <FolderMultiFilter
          id={folderPickerId}
          values={criteria.namespaces}
          invalid={invalidNamespace}
          onChange={(namespaces) => onChange({ ...criteria, namespaces })}
        />
      ),
    },
    [TOKEN_KEYS.datasource]: {
      note: invalidDataSource && <InvalidTokenNote />,
      render: () => (
        <DataSourceMultiFilter
          values={criteria.dataSourceUids}
          invalid={invalidDataSource}
          onChange={(dataSourceUids) => onChange({ ...criteria, dataSourceUids })}
        />
      ),
    },
    [TOKEN_KEYS.plugins]: {
      render: () => (
        <SwitchField
          label={t('alerting.gma-rule-list.search.property.hide-plugin-rules', 'Hide plugin rules')}
          value={criteria.hidePluginRules}
          onChange={(hidePluginRules) => onChange({ ...criteria, hidePluginRules })}
        />
      ),
    },
    [TOKEN_KEYS.dashboard]: {
      render: () => (
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
      ),
    },
    [TOKEN_KEYS.panelId]: {
      note: panelRequiresDashboard && <InvalidTokenNote />,
      render: () => (
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
      ),
    },
    [TOKEN_KEYS.contactPoint]: {
      render: () => (
        <AlertContactPointFilter
          title={criteria.contactPoint}
          disabled={Boolean(criteria.policy)}
          onChange={(contactPoint) =>
            onChange({ ...criteria, contactPoint, policy: contactPoint ? undefined : criteria.policy })
          }
        />
      ),
    },
    [TOKEN_KEYS.policy]: {
      render: () => (
        <Stack direction="column" gap={0.5}>
          <RoutingTreeSelector
            aria-label={t('alerting.gma-rule-list.search.property.policy', 'Notification policy')}
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
            // While the default policy is unavailable, the switch stays usable only to clear a
            // value that arrived through the URL or a saved search.
            disabled={Boolean(defaultPolicyUnavailable) && criteria.policy !== DEFAULT_POLICY}
            onChange={(isDefault) =>
              onChange({ ...criteria, policy: isDefault ? DEFAULT_POLICY : undefined, contactPoint: undefined })
            }
          />
          {defaultPolicyUnavailable && <UnavailableFilterNote reason={defaultPolicyUnavailable.reason()} />}
        </Stack>
      ),
    },
    [TOKEN_KEYS.paused]: {
      render: () => (
        <Combobox<PausedValue>
          aria-label={t('alerting.gma-rule-list.search.property.paused', 'Paused')}
          options={getPausedOptions()}
          value={criteria.paused ?? 'any'}
          onChange={(option: ComboboxOption<PausedValue> | null) =>
            onChange({ ...criteria, paused: !option || option.value === 'any' ? undefined : option.value })
          }
        />
      ),
    },
    [TOKEN_KEYS.state]: {
      render: () => (
        <Combobox<StateOption>
          aria-label={t('alerting.gma-rule-list.search.property.state', 'Alert state')}
          options={getStateOptions()}
          // `inactive` is an accepted spelling of `normal`; both select the same option.
          value={criteria.state === 'inactive' ? 'normal' : (criteria.state ?? 'any')}
          onChange={(option) =>
            onChange({ ...criteria, state: !option || option.value === 'any' ? undefined : option.value })
          }
        />
      ),
    },
    [TOKEN_KEYS.health]: {
      render: () => <HealthField value={criteria.health} onChange={(health) => onChange({ ...criteria, health })} />,
    },
  };

  return (
    <FilterSidebar
      definitions={alertTokens}
      controls={controls}
      onClear={onClear}
      hasActiveFilters={hasActiveFilters}
    />
  );
}

function hasIssue(issues: CriteriaIssue[], key: string): boolean {
  return issues.some((issue) => issue.key === key);
}

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
