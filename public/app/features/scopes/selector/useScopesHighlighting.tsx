import { useState } from 'react';

import { getTreeItemElementId } from './ScopesTreeItem';
import { isNodeExpandable, isNodeSelectable } from './scopesTreeUtils';
import { NodesMap, SelectedScope, TreeNode } from './types';
import { KeyboardAction, useKeyboardInteraction } from './useKeyboardInteractions';

interface UseScopesHighlightingParams {
  selectedNodes: TreeNode[];
  resultNodes: TreeNode[];
  treeQuery: string;
  scopeNodes: NodesMap;
  selectedScopes: SelectedScope[];
  onNodeUpdate: (scopeNodeId: string, expanded: boolean, query: string) => void;
  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;
}

export function useScopesHighlighting({
  selectedNodes,
  resultNodes,
  treeQuery,
  scopeNodes,
  selectedScopes,
  onNodeUpdate,
  selectScope,
  deselectScope,
}: UseScopesHighlightingParams) {
  // Enable keyboard highlighting when the search field is focused
  const [highlightEnabled, setHighlightEnabled] = useState(false);

  const items = [...selectedNodes, ...resultNodes];

  const { highlightedId } = useKeyboardInteraction(
    highlightEnabled,
    items,
    highlightEnabled ? treeQuery : '',
    (nodeId: string | undefined, action: KeyboardAction) => {
      if (!nodeId) {
        return;
      }

      const isExpanding = action === KeyboardAction.EXPAND && isNodeExpandable(scopeNodes[nodeId]);
      const isSelectingAndExpandable =
        action === KeyboardAction.SELECT &&
        !isNodeSelectable(scopeNodes[nodeId]) &&
        isNodeExpandable(scopeNodes[nodeId]);

      if (isExpanding || isSelectingAndExpandable) {
        onNodeUpdate(nodeId, true, treeQuery);
        setHighlightEnabled(false);
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

  const ariaActiveDescendant = getTreeItemElementId(highlightedId);

  return {
    highlightedId,
    ariaActiveDescendant,
    enableHighlighting: () => setHighlightEnabled(true),
    disableHighlighting: () => setHighlightEnabled(false),
  };
}
