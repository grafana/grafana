import { SelectableValue } from '@grafana/data';
import {
  DashboardRuleOutcomeRefreshIntervalKind,
  DashboardRuleOutcomeRefreshIntervalSpec,
} from '@grafana/schema/apis/dashboard.grafana.app/v3alpha0';
import { Field, Select } from '@grafana/ui';

import { DashboardRuleOutcomeKindTypes, OutcomeEditorProps, OutcomeRegistryItem } from './outcomeRegistry';

const INTERVAL_OPTIONS: Array<SelectableValue<string>> = [
  { label: '1s', value: '1s' },
  { label: '5s', value: '5s' },
  { label: '10s', value: '10s' },
  { label: '30s', value: '30s' },
  { label: '1m', value: '1m' },
  { label: '5m', value: '5m' },
  { label: '15m', value: '15m' },
  { label: '30m', value: '30m' },
  { label: '1h', value: '1h' },
];

function RefreshIntervalEditor({ spec, onChange }: OutcomeEditorProps<DashboardRuleOutcomeRefreshIntervalSpec>) {
  return (
    <Field label="Refresh interval">
      <Select
        options={INTERVAL_OPTIONS}
        value={spec.interval}
        onChange={(v) => onChange({ ...spec, interval: v.value ?? '5s' })}
      />
    </Field>
  );
}

/**
 * Refresh interval outcome: overrides the dashboard auto-refresh interval
 * while conditions are met. When conditions stop being met the original
 * refresh interval is restored.
 */
export const refreshIntervalOutcome: OutcomeRegistryItem<DashboardRuleOutcomeRefreshIntervalSpec> = {
  id: 'DashboardRuleOutcomeRefreshInterval',
  name: 'Set refresh interval',
  description: 'Override the dashboard auto-refresh interval',
  targetKinds: [],

  createDefaultSpec(): DashboardRuleOutcomeRefreshIntervalSpec {
    return { interval: '5s' };
  },

  specFromKind(kind: DashboardRuleOutcomeKindTypes): DashboardRuleOutcomeRefreshIntervalSpec {
    const refreshKind = kind as DashboardRuleOutcomeRefreshIntervalKind;
    return refreshKind.spec;
  },

  specToKind(spec: DashboardRuleOutcomeRefreshIntervalSpec): DashboardRuleOutcomeKindTypes {
    return {
      kind: 'DashboardRuleOutcomeRefreshInterval',
      spec,
    };
  },

  Editor: RefreshIntervalEditor,
};
