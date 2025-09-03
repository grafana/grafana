import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { ScopesTreeItem } from './ScopesTreeItem';
import { isNodeSelectable } from './scopesTreeUtils';
import { NodesMap, SelectedScope, TreeNode } from './types';

type Props = {
  anyChildExpanded: boolean;
  lastExpandedNode: boolean;
  loadingNodeName: string | undefined;
  items: TreeNode[];
  maxHeight: string;
  selectedScopes: SelectedScope[];
  scopeNodes: NodesMap;
  onNodeUpdate: (scopeNodeId: string, expanded: boolean, query: string) => void;
  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;
  highlightedId: string | undefined;
  id: string;
};

export function ScopesTreeItemList({
  items,
  anyChildExpanded,
  lastExpandedNode,
  maxHeight,
  selectedScopes,
  scopeNodes,
  loadingNodeName,
  onNodeUpdate,
  selectScope,
  deselectScope,
  highlightedId,
  id,
}: Props) {
  const styles = useStyles2(getStyles);

  if (items.length === 0) {
    return null;
  }

  const children = (
    <div role="tree" id={id} className={anyChildExpanded ? styles.expandedContainer : undefined}>
      {items.map((childNode) => {
        const selected =
          isNodeSelectable(scopeNodes[childNode.scopeNodeId]) &&
          selectedScopes.some((s) => {
            if (s.scopeNodeId) {
              // If we have scopeNodeId we only match based on that so even if the actual scope is the same we don't
              // mark different scopeNode as selected.
              return s.scopeNodeId === childNode.scopeNodeId;
            } else {
              return s.scopeId === scopeNodes[childNode.scopeNodeId]?.spec.linkId;
            }
          });
        return (
          <ScopesTreeItem
            key={childNode.scopeNodeId}
            treeNode={childNode}
            selected={selected}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            loadingNodeName={loadingNodeName}
            anyChildExpanded={anyChildExpanded}
            onNodeUpdate={onNodeUpdate}
            selectScope={selectScope}
            deselectScope={deselectScope}
            highlighted={childNode.scopeNodeId === highlightedId}
          />
        );
      })}
    </div>
  );

  if (lastExpandedNode) {
    return (
      <ScrollContainer minHeight={`${Math.min(5, items.length) * 30}px`} maxHeight={maxHeight}>
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
  };
};
