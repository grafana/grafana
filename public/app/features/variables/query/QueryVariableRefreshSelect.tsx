import React, { PropsWithChildren, useMemo, useState } from 'react';

import { VariableRefresh } from '@grafana/data';
import { Field, RadioButtonGroup, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';

interface Props {
  onChange: (option: VariableRefresh) => void;
  refresh: VariableRefresh;
  testId?: string;
}

const REFRESH_OPTIONS = [
  { label: 'On dashboard load', value: VariableRefresh.onDashboardLoad },
  { label: 'On time range change', value: VariableRefresh.onTimeRangeChanged },
];

export function QueryVariableRefreshSelect({ onChange, refresh, testId }: PropsWithChildren<Props>) {
  const theme = useTheme2();

  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useMediaQueryChange({
    breakpoint: theme.breakpoints.values.sm,
    onChange: (e) => {
      setIsSmallScreen(!e.matches);
    },
  });

  const value = useMemo(
    () => REFRESH_OPTIONS.find((o) => o.value === refresh)?.value ?? REFRESH_OPTIONS[0].value,
    [refresh]
  );

  return (
    <Field label="Refresh" description="When to update the values of this variable" data-testid={testId}>
      <RadioButtonGroup
        options={REFRESH_OPTIONS}
        onChange={onChange}
        value={value}
        size={isSmallScreen ? 'sm' : 'md'}
      />
    </Field>
  );
}
