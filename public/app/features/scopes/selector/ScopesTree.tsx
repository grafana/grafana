import { css } from '@emotion/css';
import { useId, useState } from 'react';
import Skeleton from 'react-loading-skeleton';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { RecentScopes } from './RecentScopes';
import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { getTreeItemElementId } from './ScopesTreeItem';
import { ScopesTreeItemList } from './ScopesTreeItemList';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { isNodeExpandable } from './scopesTreeUtils';
import { NodesMap, SelectedScope, TreeNode } from './types';
import { KeyboardAction, useKeyboardInteraction } from './useKeyboardInteractions';

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
  onRecentScopesSelect?: (scopeIds: string[], parentNodeId?: string) => void;
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

  // Used for a11y reference
  const selectedNodesToShowId = useId();
  const childrenArrayId = useId();

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

  // Only enable keyboard interaction when the search field is focused
  const [searchFocused, setSearchFocused] = useState(false);

  // Use the same highlighting for the two different lists
  const { highlightedIndex } = useKeyboardInteraction(
    searchFocused,
    [...selectedNodesToShow, ...childrenArray],
    searchFocused ? tree.query : '',
    (index: number, action: KeyboardAction) => {
      // The highlight index is for both lists, hence we need to do some trickery to get the correct item from the different lists
      const nodeId =
        index >= selectedNodesToShow.length
          ? childrenArray[index - selectedNodesToShow.length].scopeNodeId
          : selectedNodesToShow[index].scopeNodeId;

      //Handle container expand/collapse
      if (action === KeyboardAction.EXPAND && isNodeExpandable(scopeNodes[nodeId])) {
        onNodeUpdate(nodeId, true, tree.query);
        setSearchFocused(false);
        return;
      }

      // Toggle selection
      if (selectedScopes.some((s) => s.scopeNodeId === nodeId)) {
        deselectScope(nodeId);
      } else {
        selectScope(nodeId);
      }
    }
  );

  const getHighlightedId = (index: number) => {
    if (index === -1) {
      return undefined;
    }
    if (index >= selectedNodesToShow.length) {
      return childrenArray[index - selectedNodesToShow.length]?.scopeNodeId;
    }
    return selectedNodesToShow[index]?.scopeNodeId;
  };

  // Used as a label and placeholder for search field
  const nodeTitle = scopeNodes[tree.scopeNodeId]?.spec?.title || '';
  const searchArea = tree.scopeNodeId === '' ? '' : nodeTitle;

  const lastExpandedNode = !anyChildExpanded && tree.expanded;

  return (
    <>
      <ScopesTreeSearch
        anyChildExpanded={anyChildExpanded}
        searchArea={searchArea}
        onNodeUpdate={onNodeUpdate}
        treeNode={tree}
        aria-controls={`${selectedNodesToShowId} ${childrenArrayId}`}
        aria-activedescendant={getTreeItemElementId(getHighlightedId(highlightedIndex))}
        onFocus={() => setSearchFocused(true)}
        onBlur={() => setSearchFocused(false)}
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
            onNodeUpdate={onNodeUpdate}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            selectScope={selectScope}
            deselectScope={deselectScope}
            maxHeight={`${Math.min(5, selectedNodesToShow.length) * 30}px`}
            highlightedIndex={highlightedIndex}
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
            onNodeUpdate={onNodeUpdate}
            selectedScopes={selectedScopes}
            scopeNodes={scopeNodes}
            selectScope={selectScope}
            deselectScope={deselectScope}
            maxHeight={'100%'}
            highlightedIndex={highlightedIndex - selectedNodesToShow.length}
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
