import { css } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { ScrollContainer, useStyles2 } from '@grafana/ui';

import { RecentScopes } from './RecentScopes';
import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { ScopesTreeItem } from './ScopesTreeItem';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { isNodeSelectable } from './scopesTreeUtils';
import { NodesMap, SelectedScope, TreeNode } from './types';

export interface ScopesTreeProps {
  tree: TreeNode;
  loadingNodeName: string | undefined;
  selectedScopes: SelectedScope[];
  scopeNodes: NodesMap;

  onNodeUpdate: (scopeNodeId: string, expanded: boolean, query: string) => void;

  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;

  // Recent scopes are only shown at the root node
  recentScopes?: Scope[][];
  onRecentScopesSelect?: (scopeIds: string[]) => void;
}

export function ScopesTree({
  tree,
  loadingNodeName,
  selectedScopes,
  recentScopes,
  onRecentScopesSelect,
  onNodeUpdate,
  scopeNodes,
  selectScope,
  deselectScope,
}: ScopesTreeProps) {
  const styles = useStyles2(getStyles);

  const nodeLoading = loadingNodeName === tree.scopeNodeId;

  const children = tree.children;
  let childrenArray = Object.values(children || {});
  const anyChildExpanded = childrenArray.some(({ expanded }) => expanded);

  // Nodes that are already selected (not applied) are always shown if we are in their category, even if they are
  // filtered out by query filter
  let selectedNodesToShow: TreeNode[] = [];
  if (selectedScopes.length > 0 && selectedScopes[0].scopeNodeId) {
    if (tree.scopeNodeId === scopeNodes[selectedScopes[0].scopeNodeId]?.spec.parentName) {
      selectedNodesToShow = selectedScopes
        // We filter out those which are still shown in the normal list of results
        .filter((s) => !childrenArray.map((c) => c.scopeNodeId).includes(s.scopeNodeId!))
        .map((s) => ({
          // Because we had to check the parent with the use of scopeNodeId we know we have it. (we may not have it
          // if the selected scopes are from url persistence, in which case we don't show them)
          scopeNodeId: s.scopeNodeId!,
          query: '',
          expanded: false,
        }));
    }
  }

  const lastExpandedNode = !anyChildExpanded && tree.expanded;

  return (
    <>
      <ScopesTreeSearch anyChildExpanded={anyChildExpanded} onNodeUpdate={onNodeUpdate} treeNode={tree} />
      {tree.scopeNodeId === '' &&
        !anyChildExpanded &&
        recentScopes &&
        recentScopes.length > 0 &&
        onRecentScopesSelect &&
        !tree.query && <RecentScopes recentScopes={recentScopes} onSelect={onRecentScopesSelect} />}

      {nodeLoading ? (
        <Skeleton count={5} className={styles.loader} />
      ) : (
        <>
          <TreeItemList
            items={selectedNodesToShow}
            anyChildExpanded={anyChildExpanded}
            lastExpandedNode={lastExpandedNode}
            loadingNodeName={loadingNodeName}
            onNodeUpdate={onNodeUpdate}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            selectScope={selectScope}
            deselectScope={deselectScope}
            maxHeight={`${Math.min(5, selectedNodesToShow.length) * 30}px`}
          />

          <ScopesTreeHeadline
            anyChildExpanded={anyChildExpanded}
            query={tree.query}
            resultsNodes={childrenArray}
            scopeNodes={scopeNodes}
          />

          <TreeItemList
            items={childrenArray}
            anyChildExpanded={anyChildExpanded}
            lastExpandedNode={lastExpandedNode}
            loadingNodeName={loadingNodeName}
            onNodeUpdate={onNodeUpdate}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            selectScope={selectScope}
            deselectScope={deselectScope}
            maxHeight={'100%'}
          />
        </>
      )}
    </>
  );
}

type TreeItemListProps = {
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
};

function TreeItemList({
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
}: TreeItemListProps) {
  const styles = useStyles2(getStyles);

  if (items.length === 0) {
    return null;
  }

  const children = (
    <div role="tree" className={anyChildExpanded ? styles.expandedContainer : undefined}>
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
    loader: css({
      margin: theme.spacing(0.5, 0),
    }),
  };
};
