import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, useStyles2 } from '@grafana/ui';

export interface ScopesDashboardsTreeSearchProps {
  disabled: boolean;
  query: string;
  onChange: (value: string) => void;
}

export function ScopesDashboardsTreeSearch({ disabled, query, onChange }: ScopesDashboardsTreeSearchProps) {
  const styles = useStyles2(getStyles);

  const [inputState, setInputState] = useState<{ value: string; dirty: boolean }>({ value: query, dirty: false });

  const [getDebounceState] = useDebounce(
    () => {
      if (inputState.dirty) {
        onChange(inputState.value);
      }
    },
    500,
    [inputState.dirty, inputState.value]
  );

  useEffect(() => {
    if ((getDebounceState() || !inputState.dirty) && inputState.value !== query) {
      setInputState({ value: query, dirty: false });
    }
  }, [getDebounceState, inputState, query]);

  return (
    <div className={styles.container}>
      <FilterInput
        disabled={disabled}
        placeholder={t('scopes.dashboards.search', 'Search')}
        value={inputState.value}
        data-testid="scopes-dashboards-search"
        onChange={(value) => setInputState({ value, dirty: true })}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      flex: '0 1 auto',
    }),
  };
};
