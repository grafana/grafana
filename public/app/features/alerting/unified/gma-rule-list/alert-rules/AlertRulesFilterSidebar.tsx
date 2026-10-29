import { RoutingTreeSelector, isDefaultRoutingTree } from '@grafana/alerting/unstable';
import { type RoutingTree } from '@grafana/api-clients/rtkq/notifications.alerting/v1beta1';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Input, Stack, Tooltip } from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';

import { FilterSidebar, type SidebarControl } from '../token-search/FilterSidebar';
import { alertTokens } from '../token-search/alertTokens';
import { useCommonFilterControls } from '../token-search/commonFilterControls';
import { type FilterIssue } from '../token-search/filterIssues';
import { InvalidTokenNote, SwitchField, UnavailableFilterNote } from '../token-search/filterSidebarPrimitives';
import { DEFAULT_POLICY, type RuleSearchFilter, type StateValue } from '../token-search/ruleSearchFilter';
import { TOKEN_KEYS } from '../token-search/tokens';

import { AlertContactPointFilter } from './AlertContactPointFilter';

export interface AlertRulesFilterSidebarProps {
  filter: RuleSearchFilter;
  onChange: (filter: RuleSearchFilter) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  issues?: FilterIssue[];
}

export function AlertRulesFilterSidebar({
  filter,
  onChange,
  onClear,
  hasActiveFilters,
  issues = [],
}: AlertRulesFilterSidebarProps) {
  const commonControls = useCommonFilterControls(filter, onChange, issues);
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
          value={filter.dashboardUid}
          onChange={(dashboard) =>
            onChange({
              ...filter,
              dashboardUid: dashboard?.uid,
              // Panel IDs are dashboard-local — clearing the dashboard clears the panel too.
              panelId: dashboard?.uid ? filter.panelId : undefined,
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
            disabled={!filter.dashboardUid}
            invalid={panelRequiresDashboard}
            value={filter.panelId ?? ''}
            onChange={(e) => onChange({ ...filter, panelId: e.currentTarget.value || undefined })}
          />
        </Tooltip>
      ),
    },
    [TOKEN_KEYS.contactPoint]: {
      render: () => (
        <AlertContactPointFilter
          title={filter.contactPoint}
          disabled={Boolean(filter.policy)}
          onChange={(contactPoint) =>
            onChange({ ...filter, contactPoint, policy: contactPoint ? undefined : filter.policy })
          }
        />
      ),
    },
    [TOKEN_KEYS.policy]: {
      render: () => (
        <Stack direction="column" gap={0.5}>
          <RoutingTreeSelector
            aria-label={t('alerting.gma-rule-list.search.property.policy', 'Notification policy')}
            value={filter.policy === DEFAULT_POLICY ? undefined : filter.policy}
            placeholder={t('alerting.gma-rule-list.search.policy-placeholder', 'Select policy')}
            isClearable
            disabled={Boolean(filter.contactPoint) || filter.policy === DEFAULT_POLICY}
            onChange={(tree: RoutingTree | null) =>
              onChange({
                ...filter,
                policy: tree && isDefaultRoutingTree(tree) ? DEFAULT_POLICY : tree?.metadata.name,
                contactPoint: tree ? undefined : filter.contactPoint,
              })
            }
          />
          <SwitchField
            label={t('alerting.gma-rule-list.search.property.default-policy', 'Default policy')}
            value={filter.policy === DEFAULT_POLICY}
            // Usable only to clear a URL or saved-search value while the default policy is unavailable.
            disabled={Boolean(defaultPolicyUnavailable) && filter.policy !== DEFAULT_POLICY}
            onChange={(isDefault) =>
              onChange({ ...filter, policy: isDefault ? DEFAULT_POLICY : undefined, contactPoint: undefined })
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
          value={filter.paused ?? 'any'}
          onChange={(option: ComboboxOption<PausedValue> | null) =>
            onChange({ ...filter, paused: !option || option.value === 'any' ? undefined : option.value })
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
          value={filter.state === 'inactive' ? 'normal' : (filter.state ?? 'any')}
          onChange={(option) =>
            onChange({ ...filter, state: !option || option.value === 'any' ? undefined : option.value })
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
