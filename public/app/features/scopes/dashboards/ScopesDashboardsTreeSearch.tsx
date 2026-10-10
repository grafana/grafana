import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FilterInput, useStyles2 } from '@grafana/ui';

import { ContextualNavigationPaneToggle } from './ContextualNavigationPaneToggle';

export interface ScopesDashboardsTreeSearchProps {
  disabled: boolean;
  query: string;
  onChange: (value: string) => void;
  /** Whether to show the drawer expand/collapse toggle. Only meaningful next to the standalone
   * docked drawer — irrelevant (and confusing) when this search box is reused inside the mega menu,
   * which has its own open/close affordance. Defaults to `true` to preserve the drawer's behavior. */
  showNavigationToggle?: boolean;
}

export function ScopesDashboardsTreeSearch({
  disabled,
  query,
  onChange,
  showNavigationToggle = true,
}: ScopesDashboardsTreeSearchProps) {
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
        placeholder={t('scopes.dashboards.filter', 'Filter...')}
        variant="filter"
        value={inputState.value}
        data-testid="scopes-dashboards-search"
        onChange={(value) => setInputState({ value, dirty: true })}
      />
      {showNavigationToggle && <ContextualNavigationPaneToggle />}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      display: 'flex',
      gap: theme.spacing(1),
      flex: '0 1 auto',
    }),
  };
};
