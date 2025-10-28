import { useState } from 'react';

import { useScopesServices } from '../ScopesContextProvider';

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
  toggleExpandedNode: (scopeNodeId: string) => void;
  selectScope: (scopeNodeId: string) => void;
  deselectScope: (scopeNodeId: string) => void;
}

export function useScopesHighlighting({
  selectedNodes,
  resultNodes,
  treeQuery,
  scopeNodes,
  selectedScopes,
  toggleExpandedNode,
  selectScope,
  deselectScope,
}: UseScopesHighlightingParams) {
  // Enable keyboard highlighting when the search field is focused
  const [highlightEnabled, setHighlightEnabled] = useState(false);
  const services = useScopesServices();
  const { changeScopes } = services?.scopesSelectorService || {};

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
        toggleExpandedNode(nodeId);
        setHighlightEnabled(false);
        return;
      }

      // If parent has disableMultiSelect, apply scope directly
      const parentNode = scopeNodes[nodeId]?.spec.parentName
        ? scopeNodes[scopeNodes[nodeId]?.spec.parentName]
        : undefined;

      if (parentNode) {
        parentNode.spec.disableMultiSelect = true;
      }

      if (parentNode?.spec.disableMultiSelect && changeScopes && scopeNodes[nodeId]?.spec.linkId) {
        changeScopes([scopeNodes[nodeId].spec.linkId], parentNode.metadata.name);
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
