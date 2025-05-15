import { useRegisterActions } from 'kbar';
import { fromPairs } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { config } from '@grafana/runtime';

import { t } from '../../../core/internationalization';
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

  const [globalNodes, setGlobalNodes] = useState<NodesMap | undefined>(undefined);

  // Load next level of scopes when the parentId changes.
  useEffect(() => {
    if (!parentId && searchQuery && config.featureToggles.scopeSearchAllLevels) {
      // We only search globally if there is no parentId
      searchAllNodes(searchQuery, 10).then((nodes) => {
        const nodesMap = fromPairs(nodes.map((n) => [n.metadata.name, n]));
        setGlobalNodes(nodesMap);
      });
    } else {
      if (parentId) {
        updateNode(parentId, true, searchQuery);
        setGlobalNodes(undefined);
      }
    }
  }, [updateNode, searchAllNodes, searchQuery, parentId]);

  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services.scopesSelectorService.stateObservable ?? new Observable(),
    services.scopesSelectorService.state
  );

  const { nodes, scopes, loading, loadingNodeName, tree, selectedScopes, appliedScopes } = selectorServiceState;
  const nodesActions = mapScopeNodesToActions(globalNodes || nodes, tree!, selectedScopes, selectScope);

  // Other types can use the actions themselves as a dependency to prevent registering every time the hook runs. The
  // scopes tree though is loaded on demand, and it would be a deep check to see if something changes these deps are
  // approximation of when the actions really change.
  useRegisterActions(nodesActions, [parentId, loading, loadingNodeName, tree, globalNodes]);

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
          scopes={scopes}
          deselectScope={deselectScope}
          selectedScopes={selectedScopes}
          apply={finalApply}
          isDirty={isDirty}
        />
      ) : null,
  };
}

function mapScopeNodesToActions(
  nodes: NodesMap,
  tree: TreeNode,
  selectedScopes: SelectedScope[],
  selectScope: (id: string) => void
) {
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

      // Selected scopes are not shown in the list but in separate section
      if (child.spec.nodeType === 'leaf') {
        if (
          selectedScopes.some((s) => {
            if (s.scopeNodeId) {
              return s.scopeNodeId === child.metadata.name;
            } else {
              return s.scopeId === child.spec.linkId;
            }
          })
        ) {
          continue;
        }
      }

      let action: CommandPaletteAction;
      if (parentId) {
        action = {
          id: `${parentId}/${child.metadata.name}`,
          name: child.spec.title,
          keywords: `${child.spec.title} ${child.metadata.name}`,
          priority: SCOPES_PRIORITY,
          parent: parentId,
        };

        if (child.spec.nodeType === 'leaf') {
          action.perform = () => {
            selectScope(child.metadata.name);
          };
        }
      } else {
        action = {
          id: `scopes/${child.metadata.name}`,
          name: child.spec.title,
          keywords: `${child.spec.title} ${child.metadata.name}`,
          priority: SCOPES_PRIORITY,
          section: t('command-palette.action.scopes', 'Scopes'),
          subtitle: child.spec.parentName,
          perform: () => {
            selectScope(child.metadata.name);
          },
        };
      }

      actions.push(action);
      traverse(childTreeNode, action.id);
    }
  };

  traverse(tree, nodes[''] ? 'scopes' : undefined);
  return actions;
}
