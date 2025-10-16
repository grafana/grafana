import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { ScopeNode } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useScopesServices } from '../../scopes/ScopesContextProvider';
import { ScopesSelectorServiceState } from '../../scopes/selector/ScopesSelectorService';
import { NodesMap, SelectedScope, TreeNode } from '../../scopes/selector/types';
import { CommandPaletteAction } from '../types';
import { SCOPES_PRIORITY } from '../values';

export function useScopeServicesState() {
  const services = useScopesServices();
  if (!services) {
    return {
      updateNode: () => {},
      selectScope: () => {},
      resetSelection: () => {},
      searchAllNodes: () => Promise.resolve([]),
      getScopeNodes: (_: string[]) => Promise.resolve([]),
      apply: () => {},
      deselectScope: () => {},
      nodes: {},
      scopes: {},
      selectedScopes: [],
      appliedScopes: [],
      tree: {
        scopeNodeId: '',
        expanded: false,
        query: '',
      },
    };
  }
  const { updateNode, filterNode, selectScope, resetSelection, searchAllNodes, deselectScope, apply, getScopeNodes } =
    services.scopesSelectorService;
  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services.scopesSelectorService.stateObservable ?? new Observable(),
    services.scopesSelectorService.state
  );

  return {
    getScopeNodes,
    filterNode,
    updateNode,
    selectScope,
    resetSelection,
    searchAllNodes,
    apply,
    deselectScope,
    ...selectorServiceState,
  };
}

export function getScopesParentAction(): CommandPaletteAction {
  return {
    id: 'scopes',
    section: t('command-palette.action.scopes', 'Scopes'),
    name: t('command-palette.action.scopes', 'Scopes'),
    keywords: 'scopes filters',
    priority: SCOPES_PRIORITY,
  };
}

export function mapScopesNodesTreeToActions(
  nodes: NodesMap,
  tree: TreeNode,
  selectedScopes: SelectedScope[],
  selectScope: (id: string) => void
): CommandPaletteAction[] {
  const actions: CommandPaletteAction[] = [getScopesParentAction()];

  const traverse = (tree: TreeNode, parentId: string | undefined) => {
    // TODO: not sure how and why a node.nodes can be undefined
    if (!tree.children || Object.keys(tree.children).length === 0) {
      return;
    }

    for (const key of Object.keys(tree.children)) {
      const childTreeNode = tree.children[key];
      const child = nodes[key];

      const scopeIsSelected = selectedScopes.some((s) => {
        if (s.scopeNodeId) {
          return s.scopeNodeId === child.metadata.name;
        } else {
          return s.scopeId === child.spec.linkId;
        }
      });

      // Selected scopes are not shown in the list but in a separate section of the command palette.
      if (child.spec.nodeType === 'leaf' && scopeIsSelected) {
        continue;
      }
      let action = mapScopeNodeToAction(
        child,
        selectScope,
        parentId,
        child.spec.parentName ? nodes[child.spec.parentName]?.spec.title : undefined
      );
      actions.push(action);
      traverse(childTreeNode, action.id);
    }
  };

  traverse(tree, 'scopes');
  return actions;
}

/**
 * Map scopeNode to cmdK action. The typing is a bit strict, and we have 2 different cases where ew create actions
 * from global search sort of flatten out or a part of the tree structure.
 * @param scopeNode
 * @param selectScope
 * @param parentId
 */
export function mapScopeNodeToAction(
  scopeNode: ScopeNode,
  selectScope: (id: string) => void,
  parentId?: string,
  parentName?: string
): CommandPaletteAction {
  let action: CommandPaletteAction;
  const subtitle = parentName || scopeNode.spec.parentName || undefined;
  if (parentId) {
    action = {
      id: `${parentId}/${scopeNode.metadata.name}`,
      name: scopeNode.spec.title,
      subtitle: subtitle,
      keywords: `${scopeNode.spec.title} ${scopeNode.metadata.name}`,
      priority: SCOPES_PRIORITY,
      parent: parentId,
    };

    // TODO: some non leaf nodes can also be selectable, but we don't have a way to show that in the UI yet.
    if (scopeNode.spec.nodeType === 'leaf') {
      action.perform = () => {
        selectScope(scopeNode.metadata.name);
      };
    }
  } else {
    action = {
      id: `scopes/${scopeNode.metadata.name}`,
      name: scopeNode.spec.title,
      keywords: `${scopeNode.spec.title} ${scopeNode.metadata.name}`,
      priority: SCOPES_PRIORITY,
      section: t('command-palette.action.scopes', 'Scopes'),
      subtitle: subtitle,
      perform: () => {
        selectScope(scopeNode.metadata.name);
      },
    };
  }
  return action;
}
