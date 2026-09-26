import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Text, useStyles2 } from '@grafana/ui';

import { type NodesMap, type TreeNode } from './types';
import { useScopeActions } from './useScopeActions';

export interface ScopesTreeBreadcrumbProps {
  // The currently expanded branch, root excluded (see getExpandedPath). Empty when nothing is expanded.
  path: TreeNode[];
  scopeNodes: NodesMap;
}

/**
 * Shown above the tree whenever a branch is expanded (whether by manually drilling down or via a quick jump
 * shortcut), so getting back to the top level never requires re-collapsing every intermediate level by hand.
 */
export function ScopesTreeBreadcrumb({ path, scopeNodes }: ScopesTreeBreadcrumbProps) {
  const { toggleExpandedNode } = useScopeActions();
  const styles = useStyles2(getStyles);

  if (path.length === 0) {
    return null;
  }

  const titles = path.map((node) => scopeNodes[node.scopeNodeId]?.spec.title ?? node.scopeNodeId);

  return (
    <div className={styles.container} data-testid="scopes-tree-breadcrumb">
      <button
        className={styles.backButton}
        onClick={() => toggleExpandedNode(path[0].scopeNodeId)}
        data-testid="scopes-tree-breadcrumb-back"
      >
        <Icon name="arrow-left" />
        <Trans i18nKey="scopes.tree.breadcrumb.back">Back to top</Trans>
      </button>
      <Text variant="bodySmall" color="secondary" truncate>
        {titles.join(' / ')}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    margin: theme.spacing(1, 0),
    minWidth: 0,
  }),
  backButton: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    background: 'none',
    border: 0,
    padding: 0,
    margin: 0,
    flexShrink: 0,
    color: theme.colors.text.link,
    cursor: 'pointer',

    '&:hover': {
      textDecoration: 'underline',
    },
  }),
});
