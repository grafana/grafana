import { isEqual } from 'lodash';
import { Subscription } from 'rxjs';

import { ScopeDashboardBinding } from '@grafana/data';
import { config, locationService } from '@grafana/runtime';

import { ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';

import { isCurrentPath } from './scopeNavgiationUtils';
import { ScopeNavigation, SuggestedNavigationsFoldersMap, SuggestedNavigationsMap } from './types';

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
  private locationSubscription: Subscription | undefined;
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

    // Add/ remove location subscribtion based on the drawer opened state
    this.subscribeToState((state, prevState) => {
      if (state.drawerOpened === prevState.drawerOpened) {
        return;
      }
      if (state.drawerOpened && !prevState.drawerOpened) {
        // Before creating a new subscription, ensure any existing subscription is disposed to avoid multiple active subscriptions and potential memory leaks.
        this.locationSubscription?.unsubscribe();
        this.locationSubscription = locationService.getLocationObservable().subscribe((location) => {
          this.onLocationChange(location.pathname);
        });
      } else if (!state.drawerOpened && prevState.drawerOpened) {
        this.locationSubscription?.unsubscribe();
      }
    });
  }

  // Expand the group that matches the current path, if it is not already expanded
  private onLocationChange = (pathname: string) => {
    if (!this.state.drawerOpened) {
      return;
    }
    const currentPath = pathname;
    const activeScopeNavigation = this.state.scopeNavigations.find((s) => {
      if (!('url' in s.spec) || typeof s.spec.url !== 'string') {
        return false;
      }
      return isCurrentPath(currentPath, s.spec.url);
    });

    if (!activeScopeNavigation) {
      return;
    }

    // Check if the activeScopeNavigation is in a folder that is already expanded
    if (activeScopeNavigation.status.groups) {
      for (const group of activeScopeNavigation.status.groups) {
        if (this.state.folders[''].folders[group].expanded) {
          return;
        }
      }
    }

    // Expand the first group, as we don't know which one to prioritize
    if (activeScopeNavigation.status.groups) {
      this.updateFolder(['', activeScopeNavigation.status.groups[0]], true);
    }
  };

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

    // If expanding a subScope folder, fetch items for that subScope asynchronously
    if (expanded && currentFolder.isSubScope) {
      // Only fetch if folder is empty (hasn't been loaded yet)
      const isEmpty =
        Object.keys(currentFolder.folders).length === 0 && Object.keys(currentFolder.suggestedNavigations).length === 0;

      if (isEmpty) {
        // Set loading state for this folder
        currentFolder.loading = true;
        currentFilteredFolder.loading = true;
        // Extract the subScope name from the folder (stored when folder was created)
        const subScopeName = currentFolder.subScopeName || name;
        // Fetch asynchronously without blocking the state update
        this.fetchSubScopeItems(path, subScopeName);
      }
    } else if (!expanded) {
      // Clear loading state when collapsing
      currentFolder.loading = false;
      currentFilteredFolder.loading = false;
    }

    this.updateState({ folders, filteredFolders });
  };

  private fetchSubScopeItems = async (path: string[], subScopeName: string) => {
    let subScopeFolders: SuggestedNavigationsFoldersMap | undefined;

    try {
      // Fetch navigations for this subScope
      const fetchNavigations = config.featureToggles.useScopesNavigationEndpoint
        ? this.apiClient.fetchScopeNavigations
        : this.apiClient.fetchDashboards;

      const subScopeItems = await fetchNavigations([subScopeName]);

      // Group the items and add them to the subScope folder
      subScopeFolders = this.groupSuggestedItems(subScopeItems);
    } catch (error) {
      // On error, subScopeFolders will remain undefined and we'll only clear loading state
    }

    // Get the current state and navigate to the target folder
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

    // Clear loading state
    currentFolder.loading = false;
    currentFilteredFolder.loading = false;

    // Merge the subScope folder's content with the fetched items (if fetch succeeded)
    if (subScopeFolders) {
      // Take items from the root of the grouped structure
      const rootSubScopeFolder = subScopeFolders[''];
      currentFolder.folders = { ...currentFolder.folders, ...rootSubScopeFolder.folders };
      currentFolder.suggestedNavigations = {
        ...currentFolder.suggestedNavigations,
        ...rootSubScopeFolder.suggestedNavigations,
      };

      // Also update filtered folders
      currentFilteredFolder.folders = { ...currentFilteredFolder.folders, ...rootSubScopeFolder.folders };
      currentFilteredFolder.suggestedNavigations = {
        ...currentFilteredFolder.suggestedNavigations,
        ...rootSubScopeFolder.suggestedNavigations,
      };
    }

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
      const subScope = 'subScope' in navigation.spec ? navigation.spec.subScope : undefined;

      // If the current URL matches an item, expand the parent folders.
      let expanded = false;

      if (isCurrentDashboard && 'dashboard' in navigation.spec) {
        const dashboardId = currentPath.split('/')[2];
        expanded = navigation.spec.dashboard === dashboardId;
      }

      if ('url' in navigation.spec) {
        expanded = currentPath.startsWith(navigation.spec.url);
      }

      // Helper function to add navigation item to a target
      const addNavigationToTarget = (target: SuggestedNavigationsMap) => {
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
      };

      // Items with subScope completely ignore groups and go to a separate section
      // They only create expandable folders, not navigation items
      // Multiple items with the same subScope create separate folders that reference the same subScope
      if (subScope) {
        const navigationTitle =
          ('title' in navigation.status && navigation.status.title) ||
          ('dashboardTitle' in navigation.status && navigation.status.dashboardTitle) ||
          navigation.metadata.name;

        // Create a separate folder for each item, using a unique key
        // All folders with the same subScope will load the same content when expanded
        const folderKey = `${subScope}-${navigation.metadata.name}`;
        if (!rootNode.folders[folderKey]) {
          rootNode.folders[folderKey] = {
            title: navigationTitle,
            expanded,
            folders: {},
            suggestedNavigations: {},
            isSubScope: true,
            subScopeName: subScope,
          };
        }
        if (expanded && !rootNode.folders[folderKey].expanded) {
          rootNode.folders[folderKey].expanded = true;
        }
        // Don't add the navigation item - it only creates/updates the folder
      } else {
        // Items without subScope: add to group folders (if groups exist) or root
        if (groups.length > 0) {
          // Add item to all group folders at root level
          // Each group gets the item separately, not nested
          groups.forEach((group) => {
            if (group) {
              if (!rootNode.folders[group]) {
                rootNode.folders[group] = {
                  title: group,
                  expanded,
                  folders: {},
                  suggestedNavigations: {},
                };
              }
              if (expanded && !rootNode.folders[group].expanded) {
                rootNode.folders[group].expanded = true;
              }

              // Add the navigation item directly to the group folder
              addNavigationToTarget(rootNode.folders[group].suggestedNavigations);
            } else {
              // Empty string group means add to root folder
              addNavigationToTarget(rootNode.suggestedNavigations);
            }
          });
        } else {
          // If no groups, add to root
          addNavigationToTarget(rootNode.suggestedNavigations);
        }
      }
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
