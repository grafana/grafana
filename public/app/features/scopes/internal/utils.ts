import {
  InternalScopeNodesMap,
  InternalSelectedScope,
  InternalSuggestedDashboardsFoldersMap,
  InternalTreeScope,
  Scope,
  ScopeDashboardBinding,
} from '@grafana/data';

export function getBasicScope(name: string): Scope {
  return {
    metadata: { name },
    spec: {
      filters: [],
      title: name,
      type: '',
      category: '',
      description: '',
    },
  };
}

export function mergeScopes(scope1: Scope, scope2: Scope): Scope {
  return {
    ...scope1,
    metadata: {
      ...scope1.metadata,
      ...scope2.metadata,
    },
    spec: {
      ...scope1.spec,
      ...scope2.spec,
    },
  };
}

export function getTreeScopesFromSelectedScopes(scopes: InternalSelectedScope[]): InternalTreeScope[] {
  return scopes.map(({ scope, path }) => ({
    scopeName: scope.metadata.name,
    path,
  }));
}

export function getScopesFromSelectedScopes(scopes: InternalSelectedScope[]): Scope[] {
  return scopes.map(({ scope }) => scope);
}

export function getScopeNamesFromSelectedScopes(scopes: InternalSelectedScope[]): string[] {
  return scopes.map(({ scope }) => scope.metadata.name);
}

// helper func to get the selected/tree scopes together with their paths
// needed to maintain selected scopes in tree for example when navigating
// between categories or when loading scopes from URL to find the scope's path
export function getScopesAndTreeScopesWithPaths(
  selectedScopes: InternalSelectedScope[],
  treeScopes: InternalTreeScope[],
  path: string[],
  childNodes: InternalScopeNodesMap
): [InternalSelectedScope[], InternalTreeScope[]] {
  const childNodesArr = Object.values(childNodes);

  // Get all scopes without paths
  // We use tree scopes as the list is always up to date as opposed to selected scopes which can be outdated
  const scopeNamesWithoutPaths = treeScopes.filter(({ path }) => path.length === 0).map(({ scopeName }) => scopeName);

  // We search for the path of each scope name without a path
  const scopeNamesWithPaths = scopeNamesWithoutPaths.reduce<Record<string, string[]>>((acc, scopeName) => {
    const possibleParent = childNodesArr.find((childNode) => childNode.isSelectable && childNode.linkId === scopeName);

    if (possibleParent) {
      acc[scopeName] = [...path, possibleParent.name];
    }

    return acc;
  }, {});

  // Update the paths of the selected scopes based on what we found
  const newSelectedScopes = selectedScopes.map((selectedScope) => {
    if (selectedScope.path.length > 0) {
      return selectedScope;
    }

    return {
      ...selectedScope,
      path: scopeNamesWithPaths[selectedScope.scope.metadata.name] ?? [],
    };
  });

  // Update the paths of the tree scopes based on what we found
  const newTreeScopes = treeScopes.map((treeScope) => {
    if (treeScope.path.length > 0) {
      return treeScope;
    }

    return {
      ...treeScope,
      path: scopeNamesWithPaths[treeScope.scopeName] ?? [],
    };
  });

  return [newSelectedScopes, newTreeScopes];
}

export function groupDashboards(dashboards: ScopeDashboardBinding[]): InternalSuggestedDashboardsFoldersMap {
  return dashboards.reduce<InternalSuggestedDashboardsFoldersMap>(
    (acc, dashboard) => {
      const rootNode = acc[''];
      const groups = dashboard.status.groups ?? [];

      groups.forEach((group) => {
        if (group && !rootNode.folders[group]) {
          rootNode.folders[group] = {
            title: group,
            isExpanded: false,
            folders: {},
            dashboards: {},
          };
        }
      });

      const targets =
        groups.length > 0
          ? groups.map((group) => (group === '' ? rootNode.dashboards : rootNode.folders[group].dashboards))
          : [rootNode.dashboards];

      targets.forEach((target) => {
        if (!target[dashboard.spec.dashboard]) {
          target[dashboard.spec.dashboard] = {
            dashboard: dashboard.spec.dashboard,
            dashboardTitle: dashboard.status.dashboardTitle,
            items: [],
          };
        }

        target[dashboard.spec.dashboard].items.push(dashboard);
      });

      return acc;
    },
    {
      '': {
        title: '',
        isExpanded: true,
        folders: {},
        dashboards: {},
      },
    }
  );
}

export function filterFolders(
  folders: InternalSuggestedDashboardsFoldersMap,
  query: string
): InternalSuggestedDashboardsFoldersMap {
  query = (query ?? '').toLowerCase();

  return Object.entries(folders).reduce<InternalSuggestedDashboardsFoldersMap>((acc, [folderId, folder]) => {
    // If folder matches the query, we show everything inside
    if (folder.title.toLowerCase().includes(query)) {
      acc[folderId] = {
        ...folder,
        isExpanded: true,
      };

      return acc;
    }

    const filteredFolders = filterFolders(folder.folders, query);
    const filteredDashboards = Object.entries(folder.dashboards).filter(([_, dashboard]) =>
      dashboard.dashboardTitle.toLowerCase().includes(query)
    );

    if (Object.keys(filteredFolders).length > 0 || filteredDashboards.length > 0) {
      acc[folderId] = {
        ...folder,
        isExpanded: true,
        folders: filteredFolders,
        dashboards: Object.fromEntries(filteredDashboards),
      };
    }

    return acc;
  }, {});
}
