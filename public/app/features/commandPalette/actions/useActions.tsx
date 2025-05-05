import { useRegisterActions } from 'kbar';
import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { config } from '@grafana/runtime';

import { t } from '../../../core/internationalization';
import { useScopesServices } from '../../scopes/ScopesContextProvider';
import { ScopesSelectorServiceState } from '../../scopes/selector/ScopesSelectorService';
import { NodesMap, Node, TreeScope, ToggleNode } from '../../scopes/selector/types';
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

  const { updateNode, toggleNodeSelect, apply, resetSelection } = services.scopesSelectorService;

  // Initialize the scopes first time this runs and reset the scopes that were selected on unmount.
  useEffect(() => {
    updateNode([''], true, '');
    return () => {
      resetSelection();
    };
  }, [updateNode, resetSelection]);

  // Load next level of scopes when the parentId changes.
  useEffect(() => {
    updateNode(getScopePathFromActionId(parentId), true, searchQuery);
  }, [updateNode, searchQuery, parentId]);

  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services.scopesSelectorService.stateObservable ?? new Observable(),
    services.scopesSelectorService.state
  );

  const { nodes, loading, loadingNodeName, treeScopes, selectedScopes } = selectorServiceState;
  const nodesActions = mapScopeNodesToActions(nodes, treeScopes, toggleNodeSelect);

  // Other types can use the actions themselves as a dependency to prevent registering every time the hook runs. The
  // scopes tree though is loaded on demand, and it would be a deep check to see if something changes these deps are
  // approximation of when the actions really change.
  useRegisterActions(nodesActions, [parentId, loading, loadingNodeName, treeScopes]);

  const isDirty =
    treeScopes
      .map((t) => t.scopeName)
      .sort()
      .join('') !==
    selectedScopes
      .map((s) => s.scope.metadata.name)
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
      isDirty || treeScopes?.length ? (
        <ScopesRow toggleNode={toggleNodeSelect} treeScopes={treeScopes} apply={finalApply} isDirty={isDirty} />
      ) : null,
  };
}

function mapScopeNodesToActions(
  nodes: NodesMap,
  selectedScopes: TreeScope[],
  toggleNodeSelect: (node: ToggleNode) => void
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

  const traverse = (node: Node, parentId: string) => {
    // TODO: not sure how and why a node.nodes can be undefined
    if (!node.nodes || Object.keys(node.nodes).length === 0) {
      return;
    }
    for (const key of Object.keys(node.nodes)) {
      const child = node.nodes[key];

      // Selected scopes are not shown in the list but in separate section
      if (child.nodeType === 'leaf') {
        if (selectedScopes.map((s) => s.scopeName).includes(child.linkId!)) {
          continue;
        }
      }

      const action: CommandPaletteAction = {
        id: `${parentId}/${child.name}`,
        name: child.title,
        keywords: `${child.title} ${child.name}`,
        priority: SCOPES_PRIORITY,
        parent: parentId,
      };

      if (child.nodeType === 'leaf') {
        action.perform = () => {
          toggleNodeSelect({ scopeName: child.name, path: getScopePathFromActionId(action.id) });
        };
      }

      actions.push(action);
      traverse(child, action.id);
    }
  };

  traverse(nodes[''], 'scopes');
  return actions;
}

function getScopePathFromActionId(id?: string | null) {
  // The root action has id scopes while in the selectorService tree the root id = ''
  return id?.replace('scopes', '').split('/') ?? [''];
}
