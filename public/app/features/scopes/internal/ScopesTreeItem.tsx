import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Checkbox, Icon, RadioButtonDot, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

import { ScopesTree } from './ScopesTree';
import { Node, OnNodeSelectToggle, OnNodeUpdate, TreeScope } from './types';

export interface ScopesTreeItemProps {
  anyChildExpanded: boolean;
  isNodeLoading: boolean;
  loadingNodeName: string | undefined;
  node: Node;
  nodePath: string[];
  nodes: Node[];
  scopeNames: string[];
  scopes: TreeScope[];
  type: 'persisted' | 'result';
  onNodeUpdate: OnNodeUpdate;
  onNodeSelectToggle: OnNodeSelectToggle;
}

export function ScopesTreeItem({
  anyChildExpanded,
  loadingNodeName,
  node,
  nodePath,
  nodes,
  scopeNames,
  scopes,
  type,
  onNodeSelectToggle,
  onNodeUpdate,
}: ScopesTreeItemProps) {
  const styles = useStyles2(getStyles);

  return (
    <div role="tree">
      {nodes.map((childNode) => {
        const isSelected = childNode.isSelectable && scopeNames.includes(childNode.linkId!);

        if (anyChildExpanded && !childNode.isExpanded) {
          return null;
        }

        const childNodePath = [...nodePath, childNode.name];

        const radioName = childNodePath.join('.');

        return (
          <div key={childNode.name} role="treeitem" aria-selected={childNode.isExpanded}>
            <div className={styles.title}>
              {childNode.isSelectable && !childNode.isExpanded ? (
                node.disableMultiSelect ? (
                  <RadioButtonDot
                    id={radioName}
                    name={radioName}
                    checked={isSelected}
                    label=""
                    data-testid={`scopes-tree-${type}-${childNode.name}-radio`}
                    onClick={() => {
                      onNodeSelectToggle(childNodePath);
                    }}
                  />
                ) : (
                  <Checkbox
                    checked={isSelected}
                    data-testid={`scopes-tree-${type}-${childNode.name}-checkbox`}
                    onChange={() => {
                      onNodeSelectToggle(childNodePath);
                    }}
                  />
                )
              ) : null}

              {childNode.isExpandable ? (
                <button
                  className={styles.expand}
                  data-testid={`scopes-tree-${type}-${childNode.name}-expand`}
                  aria-label={
                    childNode.isExpanded ? t('scopes.tree.collapse', 'Collapse') : t('scopes.tree.expand', 'Expand')
                  }
                  onClick={() => {
                    onNodeUpdate(childNodePath, !childNode.isExpanded, childNode.query);
                  }}
                >
                  <Icon name={!childNode.isExpanded ? 'angle-right' : 'angle-down'} />

                  {childNode.title}
                </button>
              ) : (
                <span data-testid={`scopes-tree-${type}-${childNode.name}-title`}>{childNode.title}</span>
              )}
            </div>

            <div className={styles.children}>
              {childNode.isExpanded && (
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
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
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
      paddingLeft: theme.spacing(4),
    }),
  };
};
