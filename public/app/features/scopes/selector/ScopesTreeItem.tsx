import { css, cx } from '@emotion/css';

import { GrafanaTheme2, textUtil } from '@grafana/data';
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
  highlighted: boolean;

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
  highlighted,
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

  // Create highlighted version of the title if there's a query
  // Only highlight if we have a query AND this node is not expanded (not a parent showing children)
  const titleText = scopeNode.spec.title;
  const shouldHighlight = treeNode.query && !treeNode.expanded;
  const highlightedTitle = shouldHighlight ? stringToHighlighted(titleText, treeNode.query) : titleText;
  const hasHighlighting = shouldHighlight && highlightedTitle !== titleText;

  return (
    <div
      key={treeNode.scopeNodeId}
      id={getTreeItemElementId(treeNode.scopeNodeId)}
      role="treeitem"
      // aria-selected refers to the highlighted item in the tree, not the selected checkbox/radio button
      aria-selected={highlighted}
      aria-expanded={isExpandable ? treeNode.expanded : undefined}
      className={anyChildExpanded ? styles.expandedContainer : undefined}
    >
      <div
        className={cx(
          styles.title,
          isSelectable && !treeNode.expanded && styles.titlePadding,
          highlighted && styles.highlighted
        )}
      >
        {isSelectable && !treeNode.expanded ? (
          disableMultiSelect ? (
            <RadioButtonDot
              id={treeNode.scopeNodeId}
              name={treeNode.scopeNodeId}
              checked={selected}
              label={
                isExpandable
                  ? ''
                  : hasHighlighting
                  ? <span dangerouslySetInnerHTML={{ __html: textUtil.sanitizeSimpleText(highlightedTitle) }} />
                  : titleText
              }
              data-testid={`scopes-tree-${treeNode.scopeNodeId}-radio`}
              onClick={() => {
                selected ? deselectScope(treeNode.scopeNodeId) : selectScope(treeNode.scopeNodeId);
              }}
            />
          ) : (
            <div className={styles.checkboxWithLabel}>
              <Checkbox
                id={treeNode.scopeNodeId}
                checked={selected}
                data-testid={`scopes-tree-${treeNode.scopeNodeId}-checkbox`}
                label=""
                onChange={() => {
                  selected ? deselectScope(treeNode.scopeNodeId) : selectScope(treeNode.scopeNodeId);
                }}
              />
              {!isExpandable && (
                <label htmlFor={treeNode.scopeNodeId} className={styles.checkboxLabel}>
                  {hasHighlighting ? (
                    <span dangerouslySetInnerHTML={{ __html: textUtil.sanitizeSimpleText(highlightedTitle) }} />
                  ) : (
                    titleText
                  )}
                </label>
              )}
            </div>
          )
        ) : null}

        {isExpandable && (
          <button
            className={styles.expand}
            data-testid={`scopes-tree-${treeNode.scopeNodeId}-expand`}
            aria-label={treeNode.expanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')}
            onClick={() => {
              onNodeUpdate(treeNode.scopeNodeId, !treeNode.expanded, treeNode.query);
            }}
          >
            <Icon name={!treeNode.expanded ? 'angle-right' : 'angle-down'} />

            {hasHighlighting ? (
              <span dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
            ) : (
              titleText
            )}
          </button>
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

// Do substring matching, and split match string on wildcard. Add <mark> tags around the matches.
export function stringToHighlighted(string: string, match: string) {
  if (!match) {
    return string;
  }
  let result = string;
  // Split match string on wildcard.
  const matchParts = match.split('*').filter(part => part.length > 0);

  matchParts.forEach(part => {
    const regex = new RegExp(`${part}`, 'gi');
    result = result.replace(regex, `<mark>${part}</mark>`);
  });
  
  return result;
}

export const getTreeItemElementId = (scopeNodeId?: string) => {
  return scopeNodeId ? `scopes-tree-item-${scopeNodeId}` : undefined;
};

const getStyles = (theme: GrafanaTheme2) => {
  return {
    highlighted: css({
      background: theme.colors.action.focus,
      borderRadius: theme.shape.radius.default,
    }),
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

      '& > label :last-child': css({
        fontSize: theme.typography.pxToRem(14),
        lineHeight: theme.typography.pxToRem(22),
        fontWeight: theme.typography.fontWeightRegular,
      }),
    }),
    titlePadding: css({
      // Fix for checkboxes and radios outline overflow due to scrollbars
      paddingLeft: theme.spacing(0.5),
    }),
    checkboxWithLabel: css({
      alignItems: 'center',
      display: 'flex',
      gap: theme.spacing(1),
    }),
    checkboxLabel: css({
      fontSize: theme.typography.pxToRem(14),
      lineHeight: theme.typography.pxToRem(22),
      fontWeight: theme.typography.fontWeightRegular,
      cursor: 'pointer',
      margin: 0,
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
