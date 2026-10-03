import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { type TreeNode } from './types';

export interface ScopesTreeHeadlineProps {
  anyChildExpanded: boolean;
  query: string;
  resultsNodes: TreeNode[];
}

export function ScopesTreeHeadline({ anyChildExpanded, query, resultsNodes }: ScopesTreeHeadlineProps) {
  const styles = useStyles2(getStyles);

  // Only search results get a headline ("Results" / "No results..."). An unfiltered listing doesn't get a
  // "Recommended" label — there's no actual recommendation behind it, just the plain unfiltered list.
  if (anyChildExpanded || !query) {
    return null;
  }

  return (
    <h6 className={styles.container} data-testid="scopes-tree-headline">
      {resultsNodes.length === 0 ? (
        <Trans i18nKey="scopes.tree.headline.noResults">No results found for your query</Trans>
      ) : (
        <Trans i18nKey="scopes.tree.headline.results">Results</Trans>
      )}
    </h6>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    container: css({
      color: theme.colors.text.secondary,
      margin: theme.spacing(1, 0),
    }),
  };
};
