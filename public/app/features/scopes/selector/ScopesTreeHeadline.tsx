import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';

import { Node } from './types';

export interface ScopesTreeHeadlineProps {
  anyChildExpanded: boolean;
  query: string;
  resultsNodes: Node[];
}

export function ScopesTreeHeadline({ anyChildExpanded, query, resultsNodes }: ScopesTreeHeadlineProps) {
  const styles = useStyles2(getStyles);
  if (anyChildExpanded || (resultsNodes.some((n) => n.nodeType === 'container') && !query)) {
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
