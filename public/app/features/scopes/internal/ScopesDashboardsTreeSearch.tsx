import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface ScopesDashboardsTreeSearchProps {
  disabled: boolean;
  query: string;
  onChange: (value: string) => void;
}

export function ScopesDashboardsTreeSearch({ disabled, query, onChange }: ScopesDashboardsTreeSearchProps) {
  const styles = useStyles2(getStyles);

  const [inputState, setInputState] = useState<{ value: string; isDirty: boolean }>({ value: query, isDirty: false });

  const [getDebounceState] = useDebounce(
    () => {
      if (inputState.isDirty) {
        onChange(inputState.value);
      }
    },
    500,
    [inputState.isDirty, inputState.value]
  );

  useEffect(() => {
    if ((getDebounceState() || !inputState.isDirty) && inputState.value !== query) {
      setInputState({ value: query, isDirty: false });
    }
  }, [getDebounceState, inputState, query]);

  return (
    <div className={styles.container}>
      <FilterInput
        disabled={disabled}
        placeholder={t('scopes.dashboards.search', 'Search')}
        value={inputState.value}
        data-testid="scopes-dashboards-search"
        onChange={(value) => setInputState({ value, isDirty: true })}
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
