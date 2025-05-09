import { isEqual } from 'lodash';

import { ScopeDashboardBinding } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';

import { ScopeNavigation, SuggestedNavigationsFoldersMap } from './types';

interface ScopesDashboardsServiceState {
  // State of the drawer showing related dashboards
  drawerOpened: boolean;
  // by keeping a track of the raw response, it's much easier to check if we got any dashboards for the currently selected scopes
  dashboards: ScopeDashboardBinding[];
  scopeNavigations: Array<ScopeDashboardBinding | ScopeNavigation>;
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: SuggestedNavigationsFoldersMap;
  // this is a grouping in folders of the `dashboards` property. it is used for filtering the dashboards and folders when the search query changes
  folders: SuggestedNavigationsFoldersMap;
  forScopeNames: string[];
  loading: boolean;
  searchQuery: string;
}

export class ScopesDashboardsService extends ScopesServiceBase<ScopesDashboardsServiceState> {
  constructor(private apiClient: ScopesApiClient) {
    super({
      drawerOpened: false,
      dashboards: [],
      scopeNavigations: [],
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
    let currentLevelFolders: SuggestedNavigationsFoldersMap = folders;
    let currentLevelFilteredFolders: SuggestedNavigationsFoldersMap = filteredFolders;

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

    const fetchNavigations = config.featureToggles.useScopesNavigationEndpoint
      ? this.apiClient.fetchScopeNavigations
      : this.apiClient.fetchDashboards;

    const res = await fetchNavigations(forScopeNames);

    if (isEqual(this.state.forScopeNames, forScopeNames)) {
      const folders = this.groupSuggestedItems(res);
      const filteredFolders = this.filterFolders(folders, this.state.searchQuery);

      this.updateState({
        scopeNavigations: res,
        filteredFolders,
        folders,
        loading: false,
        drawerOpened: res.length > 0,
      });
    }
  };

  public groupSuggestedItems = (
    navigationItems: Array<ScopeDashboardBinding | ScopeNavigation>
  ): SuggestedNavigationsFoldersMap => {
    const currentPath = locationService.getLocation().pathname;
    const isCurrentDashboard = currentPath.startsWith('/d/');

    const folders: SuggestedNavigationsFoldersMap = {
      '': {
        title: '',
        expanded: true,
        folders: {},
        suggestedNavigations: {},
      },
    };

    // Process navigations
    navigationItems.forEach((navigation) => {
      const rootNode = folders[''];
      const groups = navigation.status.groups ?? [];

      // If the current URL matches an item, expand the parent folders.
      let expanded = false;

      if (isCurrentDashboard && 'dashboard' in navigation.spec) {
        const dashboardId = currentPath.split('/')[2];
        expanded = navigation.spec.dashboard === dashboardId;
      }

      if ('url' in navigation.spec) {
        expanded = currentPath.startsWith(navigation.spec.url);
      }

      groups.forEach((group) => {
        const groupExists = !!rootNode.folders[group];
        const groupCurrentlyExpanded = groupExists && rootNode.folders[group].expanded;

        if (group && !groupExists) {
          rootNode.folders[group] = {
            title: group,
            expanded,
            folders: {},
            suggestedNavigations: {},
          };
        }
        if (group && expanded && !groupCurrentlyExpanded) {
          rootNode.folders[group].expanded = true;
        }
      });

      const targets =
        groups.length > 0
          ? groups.map((group) =>
              group === '' ? rootNode.suggestedNavigations : rootNode.folders[group].suggestedNavigations
            )
          : [rootNode.suggestedNavigations];

      targets.forEach((target) => {
        // Dashboard
        if (
          'dashboard' in navigation.spec &&
          'dashboardTitle' in navigation.status &&
          !target[navigation.spec.dashboard]
        ) {
          target[navigation.spec.dashboard] = {
            url: '/d/' + navigation.spec.dashboard,
            title: navigation.status.dashboardTitle,
            id: navigation.spec.dashboard,
          };
        } else if ('url' in navigation.spec && 'title' in navigation.status && !target[navigation.spec.url]) {
          target[navigation.spec.url] = {
            title: navigation.status.title || navigation.metadata.name,
            url: navigation.spec.url,
            id: navigation.metadata.name,
          };
        }
      });
    });

    return folders;
  };

  public filterFolders = (folders: SuggestedNavigationsFoldersMap, query: string): SuggestedNavigationsFoldersMap => {
    query = (query ?? '').toLowerCase();

    return Object.entries(folders).reduce<SuggestedNavigationsFoldersMap>((acc, [folderId, folder]) => {
      // If folder matches the query, we show everything inside
      if (folder.title.toLowerCase().includes(query)) {
        acc[folderId] = {
          ...folder,
          expanded: true,
        };

        return acc;
      }

      const filteredFolders = this.filterFolders(folder.folders, query);

      const filteredNavigations = Object.entries(folder.suggestedNavigations).filter(([_, navigation]) =>
        navigation.title.toLowerCase().includes(query)
      );

      if (Object.keys(filteredFolders).length > 0 || filteredNavigations.length > 0) {
        acc[folderId] = {
          ...folder,
          expanded: true,
          folders: filteredFolders,
          suggestedNavigations: Object.fromEntries(filteredNavigations),
        };
      }

      return acc;
    }, {});
  };

  public toggleDrawer = () => this.updateState({ drawerOpened: !this.state.drawerOpened });
}
