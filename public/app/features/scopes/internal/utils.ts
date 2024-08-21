import { Scope, ScopeDashboardBinding } from '@grafana/data';

import { SelectedScope, SuggestedDashboardsFoldersMap, TreeScope } from './types';

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

export function getTreeScopesFromSelectedScopes(scopes: SelectedScope[]): TreeScope[] {
  return scopes.map(({ scope, path }) => ({
    scopeName: scope.metadata.name,
    path,
  }));
}

export function getScopesFromSelectedScopes(scopes: SelectedScope[]): Scope[] {
  return scopes.map(({ scope }) => scope);
}

export function getScopeNamesFromSelectedScopes(scopes: SelectedScope[]): string[] {
  return scopes.map(({ scope }) => scope.metadata.name);
}

export function groupDashboards(dashboards: ScopeDashboardBinding[]): SuggestedDashboardsFoldersMap {
  dashboards.reduce((acc, dashboard) => {
    (dashboard.spec.groups ?? []).forEach(() => {});

    return acc;
  }, {});

  return dashboards.reduce<SuggestedDashboardsFoldersMap>(
    (acc, dashboard) => {
      const rootNode = acc[''];
      const groups = dashboard.spec.groups ?? [];

      groups.forEach((group) => {
        if (!rootNode.folders[group]) {
          rootNode.folders[group] = {
            title: group,
            isExpanded: false,
            folders: {},
            dashboards: {},
          };
        }
      });

      const targets =
        groups.length > 0 ? groups.map((group) => rootNode.folders[group].dashboards) : [rootNode.dashboards];

      targets.forEach((target) => {
        if (!target[dashboard.spec.dashboard]) {
          target[dashboard.spec.dashboard] = {
            dashboard: dashboard.spec.dashboard,
            dashboardTitle: dashboard.spec.dashboardTitle,
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

export function filterFolders(folders: SuggestedDashboardsFoldersMap, query: string): SuggestedDashboardsFoldersMap {
  query = (query ?? '').toLowerCase();

  return Object.entries(folders).reduce<SuggestedDashboardsFoldersMap>((acc, [folderId, folder]) => {
    // If folder matches the query, we show everything inside
    if (folder.title.toLowerCase().includes(query)) {
      acc[folderId] = folder;

      return acc;
    }

    const filteredFolders = filterFolders(folder.folders, query);
    const filteredDashboards = Object.entries(folder.dashboards).filter(([_, dashboard]) =>
      dashboard.dashboardTitle.toLowerCase().includes(query)
    );

    if (Object.keys(filteredFolders).length > 0 || filteredDashboards.length > 0) {
      acc[folderId] = {
        ...folder,
        folders: filteredFolders,
        dashboards: Object.fromEntries(filteredDashboards),
      };
    }

    return acc;
  }, {});
}
