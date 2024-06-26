import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { FilterInput, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface ScopesTreeSearchProps {
  anyChildExpanded: boolean;
  nodePath: string[];
  query: string;
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
}

export function ScopesTreeSearch({ anyChildExpanded, nodePath, query, onNodeUpdate }: ScopesTreeSearchProps) {
  const styles = useStyles2(getStyles);

  const [queryValue, setQueryValue] = useState(query);

  useEffect(() => {
    setQueryValue(query);
  }, [query]);

  const onQueryUpdate = useMemo(() => debounce(onNodeUpdate, 500), [onNodeUpdate]);

  if (anyChildExpanded) {
    return null;
  }

  return (
    <FilterInput
      placeholder={t('scopes.tree.search', 'Search')}
      value={queryValue}
      className={styles.input}
      data-testid="scopes-tree-search"
      onChange={(value) => {
        setQueryValue(value);
        onQueryUpdate(nodePath, true, value);
      }}
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    input: css({
      margin: theme.spacing(1, 0),
    }),
  };
};
