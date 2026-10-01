import { t } from '@grafana/i18n';
import { MultiValueVariable, sceneGraph } from '@grafana/scenes';
import { Combobox } from '@grafana/ui';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

interface Props {
  dashboard: DashboardSceneLike | undefined;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  id?: string;
}

/** The dashboard variables an insight can be broken down by: those with a list of values. */
function getBreakdownVariableOptions(dashboard: DashboardSceneLike) {
  return (sceneGraph.getVariables(dashboard)?.state.variables ?? [])
    .filter((variable) => variable instanceof MultiValueVariable)
    .map((variable) => ({ value: variable.state.name, label: variable.state.label || variable.state.name }));
}

export function InsightBreakdownPicker({ dashboard, value, onChange, id }: Props) {
  const options = dashboard ? getBreakdownVariableOptions(dashboard) : [];
  // A variable removed since the question was saved stays visible, so the author sees what to fix.
  if (value && !options.some((option) => option.value === value)) {
    options.push({ value, label: value });
  }

  return (
    <Combobox
      id={id}
      isClearable
      options={options}
      value={value ?? null}
      placeholder={t('dashboard.insights.breakdown.placeholder', 'No breakdown')}
      aria-label={t('dashboard.insights.breakdown.aria-label', 'Break down by variable')}
      onChange={(option) => onChange(option?.value || undefined)}
    />
  );
}
