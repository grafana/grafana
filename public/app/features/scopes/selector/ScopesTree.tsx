import { css } from '@emotion/css';
import { useId } from 'react';
import Skeleton from 'react-loading-skeleton';
import { useObservable } from 'react-use';

import { GrafanaTheme2, Scope } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { useScopesServices } from '../ScopesContextProvider';

import { RecentScopes } from './RecentScopes';
import { ScopesTreeHeadline } from './ScopesTreeHeadline';
import { ScopesTreeItemList } from './ScopesTreeItemList';
import { ScopesTreeSearch } from './ScopesTreeSearch';
import { NodesMap, SelectedScope, TreeNode } from './types';
import { useScopeActions } from './useScopeActions';
import { useScopesHighlighting } from './useScopesHighlighting';
import { useScopesTree } from './useScopesTree';

export interface ScopesTreeProps {
  tree: TreeNode;

  // Recent scopes are only shown at the root node
  recentScopes?: Scope[][];
  onRecentScopesSelect?: (scopeIds: string[], parentNodeId?: string, scopeNodeId?: string) => void;
}

export function ScopesTree({ tree, recentScopes, onRecentScopesSelect }: ScopesTreeProps) {
  // Get state and actions from hooks instead of props
  const scopeNodes: NodesMap = useScopesTree();
  const { filterNode, selectScope, deselectScope, toggleExpandedNode } = useScopeActions();
  const services = useScopesServices();
  const selectorState = useObservable(
    services?.scopesSelectorService.stateObservable,
    services?.scopesSelectorService.state
  );

  const loadingNodeName: string | undefined = selectorState?.loadingNodeName;
  const selectedScopes: SelectedScope[] = selectorState?.selectedScopes ?? [];
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
            maxHeight={`${Math.min(5, selectedNodesToShow.length) * 30}px`}
            highlightedId={highlightedId}
            id={selectedNodesToShowId}
          />

          <ScopesTreeHeadline anyChildExpanded={anyChildExpanded} query={tree.query} resultsNodes={childrenArray} />

          <ScopesTreeItemList
            items={childrenArray}
            anyChildExpanded={anyChildExpanded}
            lastExpandedNode={lastExpandedNode}
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
