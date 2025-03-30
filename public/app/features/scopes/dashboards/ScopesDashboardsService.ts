import { isEqual } from 'lodash';

import { ScopeDashboardBinding } from '@grafana/data';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';

import { SuggestedDashboardsFoldersMap } from './types';

interface ScopesDashboardsServiceState {
  // State of the drawer showing related dashboards
  drawerOpened: boolean;
  // by keeping a track of the raw response, it's much easier to check if we got any dashboards for the currently selected scopes
  dashboards: ScopeDashboardBinding[];
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: SuggestedDashboardsFoldersMap;
  // this is a grouping in folders of the `dashboards` property. it is used for filtering the dashboards and folders when the search query changes
  folders: SuggestedDashboardsFoldersMap;
  forScopeNames: string[];
  loading: boolean;
  searchQuery: string;
}

export class ScopesDashboardsService extends ScopesServiceBase<ScopesDashboardsServiceState> {
  constructor(private apiClient: ScopesApiClient) {
    super({
      drawerOpened: false,
      dashboards: [],
      filteredFolders: {},
      folders: {},
      forScopeNames: [],
      loading: false,
      searchQuery: '',
    });
  }

  public updateFolder = (path: string[], expanded: boolean) => {
    let folders = { ...this.state.folders };
    let filteredFolders = { ...this.state.filteredFolders };
    let currentLevelFolders: SuggestedDashboardsFoldersMap = folders;
    let currentLevelFilteredFolders: SuggestedDashboardsFoldersMap = filteredFolders;

    for (let idx = 0; idx < path.length - 1; idx++) {
      currentLevelFolders = currentLevelFolders[path[idx]].folders;
      currentLevelFilteredFolders = currentLevelFilteredFolders[path[idx]].folders;
    }

    const name = path[path.length - 1];
    const currentFolder = currentLevelFolders[name];
    const currentFilteredFolder = currentLevelFilteredFolders[name];

    currentFolder.expanded = expanded;
    currentFilteredFolder.expanded = expanded;

    this.updateState({ folders, filteredFolders });
  };

  public changeSearchQuery = (searchQuery: string) => {
    searchQuery = searchQuery ?? '';

    const filteredFolders = this.filterFolders(this.state.folders, searchQuery);

    this.updateState({ filteredFolders, searchQuery });
  };

  public clearSearchQuery = () => {
    this.changeSearchQuery('');
  };

  public fetchDashboards = async (forScopeNames: string[]) => {
    if (isEqual(this.state.forScopeNames, forScopeNames)) {
      return;
    }

    if (forScopeNames.length === 0) {
      this.updateState({
        dashboards: [],
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        loading: false,
        drawerOpened: false,
      });

      return;
    }

    this.updateState({ forScopeNames, loading: true });

    const dashboards = await this.apiClient.fetchDashboards(forScopeNames);
    if (isEqual(this.state.forScopeNames, forScopeNames)) {
      const folders = this.groupDashboards(dashboards);
      const filteredFolders = this.filterFolders(folders, this.state.searchQuery);

      this.updateState({ dashboards, filteredFolders, folders, loading: false, drawerOpened: dashboards.length > 0 });
    }
  };

  public groupDashboards = (dashboards: ScopeDashboardBinding[]): SuggestedDashboardsFoldersMap => {
    return dashboards.reduce<SuggestedDashboardsFoldersMap>(
      (acc, dashboard) => {
        const rootNode = acc[''];
        const groups = dashboard.status.groups ?? [];

        groups.forEach((group) => {
          if (group && !rootNode.folders[group]) {
            rootNode.folders[group] = {
              title: group,
              expanded: false,
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
          expanded: true,
          folders: {},
          dashboards: {},
        },
      }
    );
  };

  public filterFolders = (folders: SuggestedDashboardsFoldersMap, query: string): SuggestedDashboardsFoldersMap => {
    query = (query ?? '').toLowerCase();

    return Object.entries(folders).reduce<SuggestedDashboardsFoldersMap>((acc, [folderId, folder]) => {
      // If folder matches the query, we show everything inside
      if (folder.title.toLowerCase().includes(query)) {
        acc[folderId] = {
          ...folder,
          expanded: true,
        };

        return acc;
      }

      const filteredFolders = this.filterFolders(folder.folders, query);
      const filteredDashboards = Object.entries(folder.dashboards).filter(([_, dashboard]) =>
        dashboard.dashboardTitle.toLowerCase().includes(query)
      );

      if (Object.keys(filteredFolders).length > 0 || filteredDashboards.length > 0) {
        acc[folderId] = {
          ...folder,
          expanded: true,
          folders: filteredFolders,
          dashboards: Object.fromEntries(filteredDashboards),
        };
      }

      return acc;
    }, {});
  };

  public toggleDrawer = () => this.updateState({ drawerOpened: !this.state.drawerOpened });
}
