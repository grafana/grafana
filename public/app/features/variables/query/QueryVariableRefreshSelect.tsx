import React, { PropsWithChildren, useMemo } from 'react';
import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { VariableSelectField } from '../editor/VariableSelectField';
import { VariableRefresh } from '../types';

interface Props {
  onChange: (option: SelectableValue<VariableRefresh>) => void;
  refresh: VariableRefresh;
}

const REFRESH_OPTIONS = [
  { label: 'Never', value: VariableRefresh.never },
  { label: 'On Dashboard Load', value: VariableRefresh.onDashboardLoad },
  { label: 'On Time Range Change', value: VariableRefresh.onTimeRangeChanged },
];

export function QueryVariableRefreshSelect({ onChange, refresh }: PropsWithChildren<Props>) {
  const value = useMemo(() => REFRESH_OPTIONS.find((o) => o.value === refresh) ?? REFRESH_OPTIONS[0], [refresh]);

  return (
    <VariableSelectField
      name="Refresh"
      value={value}
      options={REFRESH_OPTIONS}
      onChange={onChange}
      labelWidth={10}
      ariaLabel={selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsRefreshSelect}
      tooltip="When to update the values of this variable."
    />
  );
}
