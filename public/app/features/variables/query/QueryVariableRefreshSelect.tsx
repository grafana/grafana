import { PropsWithChildren, useMemo, useState } from 'react';

import { VariableRefresh } from '@grafana/data';
import { Field, RadioButtonGroup, useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { t } from 'app/core/internationalization';

interface Props {
  onChange: (option: VariableRefresh) => void;
  refresh: VariableRefresh;
  testId?: string;
}

const getRefreshOptions = () => {
  return [
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.refresh-options.on-dash-load',
        'On dashboard load'
      ),
      // BMC change - vishaln
      // Logic must be same for both, so keeping same button to not confuse the user
      value: VariableRefresh.onDashboardLoad || VariableRefresh.onRefreshButtonClick,
      // BMC change ends
    },
    {
      label: t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.refresh-options.on-time-change',
        'On time range change'
      ),
      value: VariableRefresh.onTimeRangeChanged,
    },
  ];
};

export function QueryVariableRefreshSelect({ onChange, refresh, testId }: PropsWithChildren<Props>) {
  const theme = useTheme2();

  const [isSmallScreen, setIsSmallScreen] = useState(false);
  useMediaQueryChange({
    breakpoint: theme.breakpoints.values.sm,
    onChange: (e) => {
      setIsSmallScreen(!e.matches);
    },
  });

  const REFRESH_OPTIONS = useMemo(() => getRefreshOptions(), []);
  const value = useMemo(
    () => REFRESH_OPTIONS.find((o) => o.value === refresh)?.value ?? REFRESH_OPTIONS[0].value,
    [REFRESH_OPTIONS, refresh]
  );

  return (
    <Field
      label={t('bmcgrafana.dashboards.settings.variables.editor.types.query.refresh', 'Refresh')}
      description={t(
        'bmcgrafana.dashboards.settings.variables.editor.types.query.refresh-desc',
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
