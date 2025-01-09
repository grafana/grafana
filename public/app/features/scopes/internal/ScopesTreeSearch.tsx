import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useDebounce } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { OnNodeUpdate } from './types';

export interface ScopesTreeSearchProps {
  anyChildExpanded: boolean;
  nodePath: string[];
  query: string;
  onNodeUpdate: OnNodeUpdate;
}

export function ScopesTreeSearch({ anyChildExpanded, nodePath, query, onNodeUpdate }: ScopesTreeSearchProps) {
  const styles = useStyles2(getStyles);

  const [inputState, setInputState] = useState<{ value: string; isDirty: boolean }>({ value: query, isDirty: false });

  useEffect(() => {
    if (!inputState.isDirty && inputState.value !== query) {
      setInputState({ value: query, isDirty: false });
    }
  }, [inputState, query]);

  useDebounce(
    () => {
      if (inputState.isDirty) {
        onNodeUpdate(nodePath, true, inputState.value);
      }
    },
    500,
    [inputState.isDirty, inputState.value]
  );

  if (anyChildExpanded) {
    return null;
  }

  return (
    <FilterInput
      placeholder={t('scopes.tree.search', 'Search')}
      value={inputState.value}
      className={styles.input}
      data-testid="scopes-tree-search"
      escapeRegex={false}
      onChange={(value) => {
        setInputState({ value, isDirty: true });
      }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    input: css({
      margin: theme.spacing(1, 0),
      minHeight: theme.spacing(4),
      height: theme.spacing(4),
      maxHeight: theme.spacing(4),
      width: `calc(100% - ${theme.spacing(0.5)})`,
    }),
  };
};
