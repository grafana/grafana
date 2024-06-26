import { css } from '@emotion/css';
import { debounce } from 'lodash';
import { useMemo } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Input, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export interface ScopesTreeSearchProps {
  anyChildExpanded: boolean;
  nodePath: string[];
  query: string;
  onNodeUpdate: (path: string[], isExpanded: boolean, query: string) => void;
}

export function ScopesTreeSearch({ anyChildExpanded, nodePath, query, onNodeUpdate }: ScopesTreeSearchProps) {
  const styles = useStyles2(getStyles);

  const onQueryUpdate = useMemo(() => debounce(onNodeUpdate, 500), [onNodeUpdate]);

  if (anyChildExpanded) {
    return null;
  }

  return (
    <Input
      prefix={<Icon name="filter" />}
      className={styles.input}
      placeholder={t('scopes.tree.search', 'Search')}
      defaultValue={query}
      data-testid="scopes-tree-search"
      onInput={(evt) => onQueryUpdate(nodePath, true, evt.currentTarget.value)}
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
