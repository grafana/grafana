import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Checkbox, Icon, RadioButtonDot, useStyles2 } from '@grafana/ui';

import { ScopesTree } from './ScopesTree';
import { isNodeExpandable, isNodeSelectable } from './scopesTreeUtils';
import { NodesMap, SelectedScope, TreeNode } from './types';

export interface ScopesTreeItemProps {
  anyChildExpanded: boolean;
  loadingNodeName: string | undefined;
  treeNode: TreeNode;
  scopeNodes: NodesMap;
  selected: boolean;
  selectedScopes: SelectedScope[];

  onNodeUpdate: (scopeNodeId: string, expanded: boolean, query: string) => void;
  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;
}

export function ScopesTreeItem({
  anyChildExpanded,
  loadingNodeName,
  treeNode,
  onNodeUpdate,
  scopeNodes,
  selected,
  selectedScopes,
  selectScope,
  deselectScope,
}: ScopesTreeItemProps) {
  const styles = useStyles2(getStyles);

  if (anyChildExpanded && !treeNode.expanded) {
    return null;
  }

  const scopeNode = scopeNodes[treeNode.scopeNodeId];
  if (!scopeNode) {
    // Should not happen as only way we show a tree is if we also load the nodes.
    return null;
  }
  const parentNode = scopeNode.spec.parentName ? scopeNodes[scopeNode.spec.parentName] : undefined;
  const disableMultiSelect = parentNode?.spec.disableMultiSelect ?? false;

  const isSelectable = isNodeSelectable(scopeNode);
  const isExpandable = isNodeExpandable(scopeNode);

  return (
    <div
      key={treeNode.scopeNodeId}
      role="treeitem"
      aria-selected={treeNode.expanded}
      className={anyChildExpanded ? styles.expandedContainer : undefined}
    >
      <div className={cx(styles.title, isSelectable && !treeNode.expanded && styles.titlePadding)}>
        {isSelectable && !treeNode.expanded ? (
          disableMultiSelect ? (
            <RadioButtonDot
              id={treeNode.scopeNodeId}
              name={treeNode.scopeNodeId}
              checked={selected}
              label=""
              data-testid={`scopes-tree-${treeNode.scopeNodeId}-radio`}
              onClick={() => {
                selected ? deselectScope(treeNode.scopeNodeId) : selectScope(treeNode.scopeNodeId);
              }}
            />
          ) : (
            <Checkbox
              checked={selected}
              data-testid={`scopes-tree-${treeNode.scopeNodeId}-checkbox`}
              onChange={() => {
                selected ? deselectScope(treeNode.scopeNodeId) : selectScope(treeNode.scopeNodeId);
              }}
            />
          )
        ) : null}

        {isExpandable ? (
          <button
            className={styles.expand}
            data-testid={`scopes-tree-${treeNode.scopeNodeId}-expand`}
            aria-label={treeNode.expanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')}
            onClick={() => {
              onNodeUpdate(treeNode.scopeNodeId, !treeNode.expanded, treeNode.query);
            }}
          >
            <Icon name={!treeNode.expanded ? 'angle-right' : 'angle-down'} />

            {scopeNode.spec.title}
          </button>
        ) : (
          <span data-testid={`scopes-tree-${treeNode.scopeNodeId}-title`}>{scopeNode.spec.title}</span>
        )}
      </div>

      <div className={styles.children}>
        {treeNode.expanded && (
          <ScopesTree
            tree={treeNode}
            loadingNodeName={loadingNodeName}
            onNodeUpdate={onNodeUpdate}
            scopeNodes={scopeNodes}
            selectedScopes={selectedScopes}
            selectScope={selectScope}
            deselectScope={deselectScope}
          />
        )}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    expandedContainer: css({
      display: 'flex',
      flexDirection: 'column',
      maxHeight: '100%',
    }),
    title: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      padding: theme.spacing(0.5, 0),

      '& > label': css({
        gap: 0,
      }),
    }),
    titlePadding: css({
      // Fix for checkboxes and radios outline overflow due to scrollbars
      paddingLeft: theme.spacing(0.5),
    }),
    expand: css({
      alignItems: 'center',
      background: 'none',
      border: 0,
      display: 'flex',
      gap: theme.spacing(1),
      margin: 0,
      padding: 0,
    }),
    children: css({
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'hidden',
      maxHeight: '100%',
      paddingLeft: theme.spacing(4),
    }),
  };
};
