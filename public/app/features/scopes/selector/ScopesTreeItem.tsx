import { css, cx } from '@emotion/css';
import { Dictionary } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, RadioButtonDot, ScrollContainer, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ScopesTree } from './ScopesTree';
import { Node, NodeReason, OnNodeSelectToggle, OnNodeUpdate, TreeScope } from './types';

export interface ScopesTreeItemProps {
  anyChildExpanded: boolean;
  groupedNodes: Dictionary<Node[]>;
  lastExpandedNode: boolean;
  loadingNodeName: string | undefined;
  node: Node;
  nodePath: string[];
  nodeReason: NodeReason;
  scopeNames: string[];
  scopes: TreeScope[];
  type: 'persisted' | 'result';
  onNodeUpdate: OnNodeUpdate;
  onNodeSelectToggle: OnNodeSelectToggle;
}

export function ScopesTreeItem({
  anyChildExpanded,
  groupedNodes,
  lastExpandedNode,
  loadingNodeName,
  node,
  nodePath,
  nodeReason,
  scopeNames,
  scopes,
  type,
  onNodeSelectToggle,
  onNodeUpdate,
}: ScopesTreeItemProps) {
  const styles = useStyles2(getStyles);

  const nodes = groupedNodes[nodeReason] || [];

  if (nodes.length === 0) {
    return null;
  }

  const children = (
    <div role="tree" className={anyChildExpanded ? styles.expandedContainer : undefined}>
      {nodes.map((childNode) => {
        const selected = childNode.selectable && scopeNames.includes(childNode.linkId!);

        if (anyChildExpanded && !childNode.expanded) {
          return null;
        }

        const childNodePath = [...nodePath, childNode.name];

        const radioName = childNodePath.join('.');

        return (
          <div
            key={childNode.name}
            role="treeitem"
            aria-selected={childNode.expanded}
            className={anyChildExpanded ? styles.expandedContainer : undefined}
          >
            <div className={cx(styles.title, childNode.selectable && !childNode.expanded && styles.titlePadding)}>
              {childNode.selectable && !childNode.expanded ? (
                node.disableMultiSelect ? (
                  <RadioButtonDot
                    id={radioName}
                    name={radioName}
                    checked={selected}
                    label=""
                    data-testid={`scopes-tree-${type}-${childNode.name}-radio`}
                    onClick={() => {
                      onNodeSelectToggle({ path: childNodePath });
                    }}
                  />
                ) : (
                  <Checkbox
                    checked={selected}
                    data-testid={`scopes-tree-${type}-${childNode.name}-checkbox`}
                    onChange={() => {
                      onNodeSelectToggle({ path: childNodePath });
                    }}
                  />
                )
              ) : null}

              {childNode.expandable ? (
                <button
                  className={styles.expand}
                  data-testid={`scopes-tree-${type}-${childNode.name}-expand`}
                  aria-label={
                    childNode.expanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')
                  }
                  onClick={() => {
                    onNodeUpdate(childNodePath, !childNode.expanded, childNode.query);
                  }}
                >
                  <Icon name={!childNode.expanded ? 'angle-right' : 'angle-down'} />

                  {childNode.title}
                </button>
              ) : (
                <span data-testid={`scopes-tree-${type}-${childNode.name}-title`}>{childNode.title}</span>
              )}
            </div>

            <div className={styles.children}>
              {childNode.expanded && (
                <ScopesTree
                  nodes={node.nodes}
                  nodePath={childNodePath}
                  loadingNodeName={loadingNodeName}
                  scopes={scopes}
                  onNodeUpdate={onNodeUpdate}
                  onNodeSelectToggle={onNodeSelectToggle}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  if (lastExpandedNode) {
    return (
      <ScrollContainer
        minHeight={`${Math.min(5, nodes.length) * 30}px`}
        maxHeight={nodeReason === NodeReason.Persisted ? `${Math.min(5, nodes.length) * 30}px` : '100%'}
      >
        {children}
      </ScrollContainer>
    );
  }

  return children;
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
