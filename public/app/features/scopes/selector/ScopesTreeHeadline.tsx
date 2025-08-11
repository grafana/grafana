import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';

import { NodesMap, TreeNode } from './types';

export interface ScopesTreeHeadlineProps {
  anyChildExpanded: boolean;
  query: string;
  resultsNodes: TreeNode[];
  scopeNodes: NodesMap;
}

export function ScopesTreeHeadline({ anyChildExpanded, query, resultsNodes, scopeNodes }: ScopesTreeHeadlineProps) {
  const styles = useStyles2(getStyles);

  if (
    anyChildExpanded ||
    (resultsNodes.some((n) => scopeNodes[n.scopeNodeId].spec.nodeType === 'container') && !query)
  ) {
    return null;
  }

  return (
    <h6 className={styles.container} data-testid="scopes-tree-headline">
      {!query ? (
        <Trans i18nKey="scopes.tree.headline.recommended">Recommended</Trans>
      ) : resultsNodes.length === 0 ? (
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
