import { useRegisterActions } from 'kbar';
import { useEffect, useMemo, useState } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { t } from '../../../core/internationalization';
import { useScopesServices } from '../../scopes/ScopesContextProvider';
import { ScopesSelectorServiceState } from '../../scopes/selector/ScopesSelectorService';
import { NodesMap, Node } from '../../scopes/selector/types';
import { CommandPaletteAction } from '../types';
import { SCOPES_PRIORITY } from '../values';

import { getRecentDashboardActions } from './dashboardActions';
import { useStaticActions } from './staticActions';
import useExtensionActions from './useExtensionActions';

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
  // Load recent dashboards - we don't want them to reload when the nav tree changes
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

export function useRegisterScopesActions(searchQuery: string, parentId?: string | null) {
  const services = useScopesServices();

  // Conditional hooks, but this should only change if feature toggles changes.
  if (!services) {
    return;
  }

  const { open, updateNode, toggleNodeSelect } = services.scopesSelectorService;

  // Initialize the scopes first time this runs.
  useEffect(() => {
    open();
  }, [open]);

  useEffect(() => {
    updateNode(getScopePathFromActionId(parentId), true, searchQuery);
  }, [updateNode, searchQuery, parentId]);

  const selectorServiceState: ScopesSelectorServiceState | undefined = useObservable(
    services.scopesSelectorService.stateObservable ?? new Observable(),
    services.scopesSelectorService.state
  );

  const { nodes, loading, loadingNodeName } = selectorServiceState;
  const nodesActions = mapScopeNodesToActions(nodes, toggleNodeSelect);

  // Other types can use the actions themselves as a dependency to prevent registering every time the hook runs. The
  // scopes tree though is loaded on demand, and it would be a deep check to see if something changes so the current
  // parentId and searchQuery are good proxy to when the nodes and thus action would change.
  useRegisterActions(nodesActions, [parentId, loading, loadingNodeName]);
}

function mapScopeNodesToActions(nodes: NodesMap, selectNode: (path: string[]) => void) {
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
    if (Object.keys(node.nodes).length === 0) {
      return;
    }
    for (const key of Object.keys(node.nodes)) {
      const child = node.nodes[key];
      const action: CommandPaletteAction = {
        id: `${parentId}/${child.name}`,
        name: child.title,
        section: t('command-palette.action.scopes', 'Scopes'),
        keywords: `${child.title} ${child.name}`,
        priority: SCOPES_PRIORITY,
        parent: parentId,
      };

      if (child.nodeType === 'leaf') {
        action.perform = () => {
          selectNode(getScopePathFromActionId(action.id));
          return true;
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
