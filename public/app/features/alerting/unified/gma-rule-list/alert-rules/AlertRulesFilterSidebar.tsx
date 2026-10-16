import { RoutingTreeSelector, isDefaultRoutingTree } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Input, Stack, Tooltip } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { FilterSidebar, type SidebarControl } from '../rule-search/FilterSidebar';
import { alertTokens } from '../rule-search/alertTokens';
import { useCommonFilterControls } from '../rule-search/commonFilterControls';
import { type Criteria, DEFAULT_POLICY, type StateValue } from '../rule-search/criteria';
import { type CriteriaIssue } from '../rule-search/criteriaIssues';
import { InvalidTokenNote, SwitchField, UnavailableFilterNote } from '../rule-search/filterSidebarPrimitives';
import { TOKEN_KEYS } from '../rule-search/tokens';

import { AlertContactPointFilter } from './AlertContactPointFilter';

export interface AlertRulesFilterSidebarProps {
  criteria: Criteria;
  onChange: (criteria: Criteria) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  issues?: CriteriaIssue[];
}

export function AlertRulesFilterSidebar({
  criteria,
  onChange,
  onClear,
  hasActiveFilters,
  issues = [],
}: AlertRulesFilterSidebarProps) {
  const commonControls = useCommonFilterControls(criteria, onChange, issues);
  const panelRequiresDashboard = issues.some(
    (issue) => issue.key === 'panelId' && issue.reason === 'requiresDashboard'
  );
  const defaultPolicyUnavailable = alertTokens
    .find((definition) => definition.key === TOKEN_KEYS.policy)
    ?.unavailableValues?.find((unavailable) => unavailable.value === DEFAULT_POLICY);

  const controls: Record<string, SidebarControl> = {
    ...commonControls,
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
                policy: tree && isDefaultRoutingTree(tree) ? DEFAULT_POLICY : tree?.metadata.name,
                contactPoint: tree ? undefined : criteria.contactPoint,
              })
            }
          />
          <SwitchField
            label={t('alerting.gma-rule-list.search.property.default-policy', 'Default policy')}
            value={criteria.policy === DEFAULT_POLICY}
            // Usable only to clear a URL or saved-search value while the default policy is unavailable.
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
