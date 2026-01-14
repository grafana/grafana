import { css } from '@emotion/css';
import { useId } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { RecentScopes } from './RecentScopes';
import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { ScopesTreeItemList } from './ScopesTreeItemList';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { NodesMap, SelectedScope, TreeNode } from './types';
import { useScopesHighlighting } from './useScopesHighlighting';

export interface ScopesTreeProps {
  tree: TreeNode;
  loadingNodeName: string | undefined;
  selectedScopes: SelectedScope[];
  scopeNodes: NodesMap;

  filterNode: (scopeNodeId: string, query: string) => void;

  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;

  // Recent scopes are only shown at the root node
  recentScopes?: Scope[][];
  onRecentScopesSelect?: (scopeIds: string[], parentNodeId?: string, scopeNodeId?: string) => void;

  toggleExpandedNode: (scopeNodeId: string) => void;
}

export function ScopesTree({
  tree,
  loadingNodeName,
  selectedScopes,
  recentScopes,
  onRecentScopesSelect,
  filterNode,
  scopeNodes,
  selectScope,
  deselectScope,
  toggleExpandedNode,
}: ScopesTreeProps) {
  const styles = useStyles2(getStyles);

  // Used for a11y reference
  const selectedNodesToShowId = useId();
  const childrenArrayId = useId();

  const nodeLoading = loadingNodeName === tree.scopeNodeId;

  const children = tree.children;
  let childrenArray = Object.values(children || {});
  const anyChildExpanded = childrenArray.some(({ expanded }) => expanded);

  // Nodes that are already selected (not applied) are always shown if we are in their category, even if they are
  // filtered out by query filter. Only consider the first selected scope for this display logic.
  let selectedNodesToShow: TreeNode[] = [];
  const firstSelectedScope = selectedScopes[0];
  if (
    firstSelectedScope?.scopeNodeId &&
    scopeNodes[firstSelectedScope.scopeNodeId] &&
    tree.scopeNodeId === scopeNodes[firstSelectedScope.scopeNodeId]?.spec.parentName &&
    !childrenArray.map((c) => c.scopeNodeId).includes(firstSelectedScope.scopeNodeId)
  ) {
    selectedNodesToShow = [
      {
        scopeNodeId: firstSelectedScope.scopeNodeId,
        query: '',
        expanded: false,
      },
    ];
  }

  const { highlightedId, ariaActiveDescendant, enableHighlighting, disableHighlighting } = useScopesHighlighting({
    selectedNodes: selectedNodesToShow,
    resultNodes: childrenArray,
    treeQuery: tree.query,
    scopeNodes,
    selectedScopes,
    toggleExpandedNode,
    selectScope,
    deselectScope,
  });

  // Used as a label and placeholder for search field
  const nodeTitle = scopeNodes[tree.scopeNodeId]?.spec?.title || '';
  const searchArea = tree.scopeNodeId === '' ? '' : nodeTitle;

  const lastExpandedNode = !anyChildExpanded && tree.expanded;

  return (
    <>
      <ScopesTreeSearch
        anyChildExpanded={anyChildExpanded}
        searchArea={searchArea}
        filterNode={filterNode}
        treeNode={tree}
        aria-controls={`${selectedNodesToShowId} ${childrenArrayId}`}
        aria-activedescendant={ariaActiveDescendant}
        onFocus={enableHighlighting}
        onBlur={disableHighlighting}
      />
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
          <ScopesTreeItemList
            items={selectedNodesToShow}
            anyChildExpanded={anyChildExpanded}
            lastExpandedNode={lastExpandedNode}
            loadingNodeName={loadingNodeName}
            filterNode={filterNode}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            selectScope={selectScope}
            deselectScope={deselectScope}
            toggleExpandedNode={toggleExpandedNode}
            maxHeight={`${Math.min(5, selectedNodesToShow.length) * 30}px`}
            highlightedId={highlightedId}
            id={selectedNodesToShowId}
          />

          <ScopesTreeHeadline
            anyChildExpanded={anyChildExpanded}
            query={tree.query}
            resultsNodes={childrenArray}
            scopeNodes={scopeNodes}
          />

          <ScopesTreeItemList
            items={childrenArray}
            anyChildExpanded={anyChildExpanded}
            lastExpandedNode={lastExpandedNode}
            loadingNodeName={loadingNodeName}
            filterNode={filterNode}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            selectScope={selectScope}
            toggleExpandedNode={toggleExpandedNode}
            deselectScope={deselectScope}
            maxHeight={'100%'}
            highlightedId={highlightedId}
            id={childrenArrayId}
          />
        </>
      )}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  return {
    loader: css({
      margin: theme.spacing(0.5, 0),
    }),
  };
};
