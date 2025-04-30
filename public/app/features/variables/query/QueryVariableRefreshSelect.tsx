import { PropsWithChildren, useMemo } from 'react';

import { VariableRefresh } from '@grafana/data';
import { Field, RadioButtonGroup } from '@grafana/ui';
import { useMediaQueryMinWidth } from 'app/core/hooks/useMediaQueryMinWidth';
import { t } from 'app/core/internationalization';

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
  const isSmallScreen = !useMediaQueryMinWidth('sm');

  const value = useMemo(
    () => REFRESH_OPTIONS.find((o) => o.value === refresh)?.value ?? REFRESH_OPTIONS[0].value,
    [refresh]
  );

  return (
    <Field
      label={t('variables.query-variable-refresh-select.label-refresh', 'Refresh')}
      description={t(
        'variables.query-variable-refresh-select.description-update-values-variable',
        'When to update the values of this variable'
      )}
      data-testid={testId}
    >
      <RadioButtonGroup
        options={REFRESH_OPTIONS}
        onChange={onChange}
        value={value}
        size={isSmallScreen ? 'sm' : 'md'}
      />
    </Field>
  );
}
