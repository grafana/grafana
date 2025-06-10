import { useRegisterActions } from 'kbar';
import { fromPairs, last } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { ScopeNode } from '@grafana/data';
import { t } from '@grafana/i18n/internal';
import { config } from '@grafana/runtime';

import { useScopesServices } from '../../scopes/ScopesContextProvider';
import { ScopesSelectorServiceState } from '../../scopes/selector/ScopesSelectorService';
import { NodesMap, SelectedScope, TreeNode } from '../../scopes/selector/types';
import { ScopesRow } from '../ScopesRow';
import { CommandPaletteAction } from '../types';
import { SCOPES_PRIORITY } from '../values';

import { getRecentDashboardActions } from './dashboardActions';
import { getRecentScopesActions } from './recentScopesActions';
import { useStaticActions } from './staticActions';
import useExtensionActions from './useExtensionActions';

/**
 * Register navigation actions to different parts of grafana or some preferences stuff like themes.
 */
export function useRegisterStaticActions() {
  const extensionActions = useExtensionActions();
  const staticActions = useStaticActions();

  const navTreeActions = useMemo(() => {
    return [...staticActions, ...extensionActions];
  }, [staticActions, extensionActions]);

  useRegisterActions(navTreeActions, [navTreeActions]);
}

export function useRegisterRecentDashboardsActions(searchQuery: string) {
  const [recentDashboardActions, setRecentDashboardActions] = useState<CommandPaletteAction[]>([]);
  useEffect(() => {
    if (!searchQuery) {
      getRecentDashboardActions()
        .then((recentDashboardActions) => setRecentDashboardActions(recentDashboardActions))
        .catch((err) => {
          console.error('Error loading recent dashboard actions', err);
        });
    }
  }, [searchQuery]);

  useRegisterActions(recentDashboardActions, [recentDashboardActions]);
}

export function useRegisterRecentScopesActions() {
  const recentScopesActions = getRecentScopesActions();
  useRegisterActions(recentScopesActions, [recentScopesActions]);
}

/**
 * Special actions for scopes. Scopes are already hierarchical and loaded dynamically so we create actions based on
 * them as we load them. This also returns an additional component to be shown with selected actions and a button to
 * apply the selection.
 * @param searchQuery
 * @param onApply
 * @param parentId
 */
export function useRegisterScopesActions(
  searchQuery: string,
  onApply: () => void,
  parentId?: string | null
): { scopesRow?: ReactNode } {
  const services = useScopesServices();

  // Conditional hooks, but this should only change if feature toggles changes so not in runtime.
  if (!(config.featureToggles.scopeFilters && services)) {
    return { scopesRow: undefined };
  }

  const { updateNode, selectScope, deselectScope, apply, resetSelection, searchAllNodes } =
    services.scopesSelectorService;

  // Initialize the scopes first time this runs and reset the scopes that were selected on unmount.
  useEffect(() => {
    updateNode('', true, '');
    resetSelection();
    return () => {
      resetSelection();
    };
  }, [updateNode, resetSelection]);

  const globalNodes = useGlobalScopesSearch(searchQuery, searchAllNodes, parentId);

  // Load the next level of scopes when the parentId changes.
  useEffect(() => {
    if (parentId) {
      updateNode(parentId === 'scopes' ? '' : last(parentId.split('/'))!, true, searchQuery);
    }
  }, [updateNode, searchQuery, parentId]);

  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services.scopesSelectorService.stateObservable ?? new Observable(),
    services.scopesSelectorService.state
  );

  const { nodes, scopes, tree, selectedScopes, appliedScopes } = selectorServiceState;

  const nodesActions = useMemo(() => {
    // If we have nodes from global search, we show those in a flat list.
    return globalNodes
      ? Object.values(globalNodes).map((node) => mapScopeNodeToAction(node, selectScope))
      : mapScopesNodesTreeToActions(nodes, tree!, selectedScopes, selectScope);
  }, [globalNodes, nodes, tree, selectedScopes, selectScope]);

  useRegisterActions(nodesActions, [nodesActions]);

  // Check if we have different selection than what is already applied. Used to show the apply button.
  const isDirty =
    appliedScopes
      .map((t) => t.scopeId)
      .sort()
      .join('') !==
    selectedScopes
      .map((s) => s.scopeId)
      .sort()
      .join('');

  const finalApply = useCallback(() => {
    apply();
    onApply();
  }, [apply, onApply]);

  // Add keyboard shortcut to apply the selection.
  useEffect(() => {
    function handler(event: KeyboardEvent) {
      if (isDirty && event.key === 'Enter' && event.metaKey) {
        event.preventDefault();
        finalApply();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isDirty, finalApply]);

  return {
    scopesRow:
      isDirty || selectedScopes?.length ? (
        <ScopesRow
          nodes={nodes}
          scopes={scopes}
          deselectScope={deselectScope}
          selectedScopes={selectedScopes}
          apply={finalApply}
          isDirty={isDirty}
        />
      ) : null,
  };
}

function useGlobalScopesSearch(
  searchQuery: string,
  searchAllNodes: (search: string, limit: number) => Promise<ScopeNode[]>,
  parentId?: string | null
) {
  const [nodes, setNodes] = useState<NodesMap | undefined>(undefined);
  const searchQueryRef = useRef<string>();

  // Load next level of scopes when the parentId changes.
  useEffect(() => {
    if (!parentId && searchQuery && config.featureToggles.scopeSearchAllLevels) {
      // We only search globally if there is no parentId
      searchQueryRef.current = searchQuery;
      searchAllNodes(searchQuery, 10).then((nodes) => {
        if (searchQueryRef.current === searchQuery) {
          const nodesMap = fromPairs(nodes.map((n) => [n.metadata.name, n]));
          setNodes(nodesMap);
        }
      });
    } else {
      searchQueryRef.current = undefined;
      setNodes(undefined);
    }
  }, [searchAllNodes, searchQuery, parentId]);

  return nodes;
}

function mapScopesNodesTreeToActions(
  nodes: NodesMap,
  tree: TreeNode,
  selectedScopes: SelectedScope[],
  selectScope: (id: string) => void
): CommandPaletteAction[] {
  const actions: CommandPaletteAction[] = [
    {
      id: 'scopes',
      section: t('command-palette.action.scopes', 'Scopes'),
      name: t('command-palette.action.scopes', 'Scopes'),
      keywords: 'scopes filters',
      priority: SCOPES_PRIORITY,
    },
  ];

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
      let action = mapScopeNodeToAction(child, selectScope, parentId);
      actions.push(action);
      traverse(childTreeNode, action.id);
    }
  };

  traverse(tree, 'scopes');
  return actions;
}

/**
 * Map scopeNode to cmdK action. The typing is a bit strict and we have 2 different cases where ew create actions
 * from global search sort of flatten out or a part of the tree structure.
 * @param scopeNode
 * @param selectScope
 * @param parentId
 */
function mapScopeNodeToAction(
  scopeNode: ScopeNode,
  selectScope: (id: string) => void,
  parentId?: string
): CommandPaletteAction {
  let action: CommandPaletteAction;
  if (parentId) {
    action = {
      id: `${parentId}/${scopeNode.metadata.name}`,
      name: scopeNode.spec.title,
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
      subtitle: scopeNode.spec.parentName,
      perform: () => {
        selectScope(scopeNode.metadata.name);
      },
    };
  }
  return action;
}
