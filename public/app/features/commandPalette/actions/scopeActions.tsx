import { useRegisterActions } from 'kbar';
import { last } from 'lodash';
import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { config } from '@grafana/runtime';

import { ScopesRow } from '../ScopesRow';
import { CommandPaletteAction } from '../types';

import { getRecentScopesActions } from './recentScopesActions';
import {
  getScopesParentAction,
  mapScopeNodeToAction,
  mapScopesNodesTreeToActions,
  useScopeServicesState,
} from './scopesUtils';

export function useRegisterRecentScopesActions() {
  const recentScopesActions = getRecentScopesActions();
  useRegisterActions(recentScopesActions, [recentScopesActions]);
}

/**
 * Special actions for scopes. Scopes are already hierarchical and loaded dynamically, so we create actions based on
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
  // Conditional hooks, but this should only change if feature toggles changes so not in runtime.
  if (!config.featureToggles.scopeFilters) {
    return { scopesRow: undefined };
  }

  const globalScopeActions = useGlobalScopesSearch(searchQuery, parentId);
  const scopeTreeActions = useScopeTreeActions(searchQuery, parentId);

  // If we have global search actions we use those. Inside the hook the search should be conditional based on where
  // in the command palette we are.
  const nodesActions = globalScopeActions || scopeTreeActions;

  useRegisterActions(nodesActions, [nodesActions]);

  // Returns a component to show what scopes are selected or applied.
  return useScopesRow(onApply);
}

/**
 * Register actions based on the scopes tree structure. This handles the scope service updates and uses it as the
 * source of truth.
 * @param searchQuery
 * @param parentId
 */
function useScopeTreeActions(searchQuery: string, parentId?: string | null) {
  const { updateNode, selectScope, resetSelection, nodes, tree, selectedScopes } = useScopeServicesState();

  // Initialize the scopes the first time this runs and reset the scopes that were selected on unmount.
  useEffect(() => {
    updateNode('', true, '');
    resetSelection();
    return () => {
      resetSelection();
    };
  }, [updateNode, resetSelection]);

  // Load the next level of scopes when the parentId changes.
  useEffect(() => {
    const parentScopeId = !parentId || parentId === 'scopes' ? '' : last(parentId.split('/'))!;
    updateNode(parentScopeId, true, searchQuery);
  }, [updateNode, searchQuery, parentId]);

  return useMemo(
    () => mapScopesNodesTreeToActions(nodes, tree!, selectedScopes, selectScope),
    [nodes, tree, selectedScopes, selectScope]
  );
}

/**
 * Returns an element to add to the command palette in case some scopes are selected, showing them and an apply
 * button.
 * @param onApply
 */
function useScopesRow(onApply: () => void) {
  const { nodes, scopes, selectedScopes, appliedScopes, deselectScope, apply } = useScopeServicesState();

  // Check if we have a different selection than what is already applied. Used to show the apply button.
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

  // Add a keyboard shortcut to apply the selection.
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

/**
 * Register actions based on global search call. This returns actions that are separate from the scope service tree
 * and are just flat list without updating the scope service state.
 * @param searchQuery
 * @param parentId
 */
function useGlobalScopesSearch(searchQuery: string, parentId?: string | null) {
  const { selectScope, searchAllNodes } = useScopeServicesState();
  const [actions, setActions] = useState<CommandPaletteAction[] | undefined>(undefined);
  const searchQueryRef = useRef<string>();

  useEffect(() => {
    if ((!parentId || parentId === 'scopes') && searchQuery && config.featureToggles.scopeSearchAllLevels) {
      // We only search globally if there is no parentId
      searchQueryRef.current = searchQuery;
      searchAllNodes(searchQuery, 10).then((nodes) => {
        if (searchQueryRef.current === searchQuery) {
          // Only show leaf nodes because otherwise there are issues with navigating to a category without knowing
          // where in the tree it is.
          const leafNodes = nodes.filter((node) => node.spec.nodeType === 'leaf');
          const actions = [getScopesParentAction()];
          for (const node of leafNodes) {
            actions.push(mapScopeNodeToAction(node, selectScope, parentId || undefined));
          }
          setActions(actions);
        }
      });
    } else {
      searchQueryRef.current = undefined;
      setActions(undefined);
    }
  }, [searchAllNodes, searchQuery, parentId, selectScope]);

  return actions;
}
