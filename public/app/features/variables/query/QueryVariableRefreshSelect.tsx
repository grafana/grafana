import React, { PropsWithChildren, useMemo } from 'react';

import { VariableRefresh } from '@grafana/data';
import { Field, RadioButtonGroup } from '@grafana/ui';

interface Props {
  onChange: (option: VariableRefresh) => void;
  refresh: VariableRefresh;
}

const REFRESH_OPTIONS = [
  { label: 'On dashboard load', value: VariableRefresh.onDashboardLoad },
  { label: 'On time range change', value: VariableRefresh.onTimeRangeChanged },
];

export function QueryVariableRefreshSelect({ onChange, refresh }: PropsWithChildren<Props>) {
  const value = useMemo(
    () => REFRESH_OPTIONS.find((o) => o.value === refresh)?.value ?? REFRESH_OPTIONS[0].value,
    [refresh]
  );

  return (
    <Field label="Refresh" description="When to update the values of this variable">
      <RadioButtonGroup options={REFRESH_OPTIONS} onChange={onChange} value={value} />
    </Field>
  );
}
