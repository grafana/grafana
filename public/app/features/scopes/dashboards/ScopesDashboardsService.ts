import { isEqual } from 'lodash';
import { type Subscription } from 'rxjs';

import { locationService } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';

import { type ScopesApiClient } from '../ScopesApiClient';
import { ScopesServiceBase } from '../ScopesServiceBase';

import { buildSubScopePath, isCurrentPath } from './scopeNavgiationUtils';
import {
  type ScopeNavigation,
  type SuggestedNavigationsFolder,
  type SuggestedNavigationsFoldersMap,
  type SuggestedNavigationsMap,
} from './types';

interface ScopesDashboardsServiceState {
  // State of the drawer showing related dashboards
  drawerOpened: boolean;
  // by keeping a track of the raw response, it's much easier to check if we got any navigations for the currently selected scopes
  scopeNavigations: ScopeNavigation[];
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: SuggestedNavigationsFoldersMap;
  // this is a grouping in folders of the `scopeNavigations` property. it is used for filtering the dashboards and folders when the search query changes
  folders: SuggestedNavigationsFoldersMap;
  forScopeNames: string[];
  loading: boolean;
  searchQuery: string;
  navigationScope?: string;
  // Path of subScopes which should be expanded
  navScopePath?: string[];
}

export class ScopesDashboardsService extends ScopesServiceBase<ScopesDashboardsServiceState> {
  private locationSubscription: Subscription | undefined;
  constructor(private apiClient: ScopesApiClient) {
    super({
      drawerOpened: false,
      scopeNavigations: [],
      filteredFolders: {},
      folders: {},
      forScopeNames: [],
      loading: false,
      searchQuery: '',
      navScopePath: undefined,
    });

    if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaScopesDashboardsMegaMenu, false)) {
      // With the mega-menu flag on, ScopesDashboardsMegaMenuSection renders this tree independent of
      // drawerOpened entirely (unlike the legacy drawer below), so drawerOpened no longer corresponds
      // to "is anything showing this". Track location for the service's whole lifetime instead, so
      // the "current folder" state stays fresh for whenever the mega menu is next opened - including
      // while drawerOpened is temporarily false, e.g. DashboardSceneRenderer flips it during edit mode.
      this.locationSubscription = locationService.getLocationObservable().subscribe((location) => {
        this.onLocationChange(location.pathname);
      });
    } else {
      // Flag off: unchanged original behavior. The legacy drawer is the only consumer of this tree
      // and is itself gated on drawerOpened, so there's no point tracking location while it's closed.
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
  }

  private openSubScopeFolder = (subScopePath: string[]) => {
    const subScope = subScopePath[subScopePath.length - 1];
    const path = buildSubScopePath(subScope, this.state.folders);

    // Get path to the folder - path can now be undefined
    if (path && path.length > 0) {
      this.updateFolder(path, true);
    }
  };

  public setNavScopePath = async (navScopePath?: string[]) => {
    const navScopePathArray = navScopePath ?? [];

    if (!isEqual(navScopePathArray, this.state.navScopePath)) {
      this.updateState({ navScopePath: navScopePathArray });

      for (const subScope of navScopePathArray) {
        // Find the actual path to the folder with this subScopeName
        const folderPath = buildSubScopePath(subScope, this.state.folders);
        if (folderPath && folderPath.length > 0) {
          await this.fetchSubScopeItems(folderPath, subScope);
          this.openSubScopeFolder([subScope]);
        }
      }
    }
  };

  // The fallbackScopeNames is used to fetch the ScopeNavigations for the current dashboard when the navigationScope is not set.
  // You only need to awaut this function if you need to wait for the dashboards to be fetched before doing something else.
  public setNavigationScope = async (
    navigationScope?: string,
    fallbackScopeNames?: string[],
    navScopePath?: string[]
  ) => {
    if (this.state.navigationScope === navigationScope) {
      return;
    }

    const forScopeNames = navigationScope ? [navigationScope] : (fallbackScopeNames ?? []);
    this.updateState({ navigationScope, drawerOpened: forScopeNames.length > 0 });
    await this.fetchDashboards(forScopeNames);
    await this.setNavScopePath(navScopePath);
  };

  // Expand the group that matches the current path, if it is not already expanded. Only ever called
  // while a location subscription is active - the constructor gates whether that's true (not
  // necessarily corresponding to the current drawerOpened value, see the flag branch there).
  private onLocationChange = (pathname: string) => {
    const currentPath = pathname;
    const activeScopeNavigation = this.state.scopeNavigations.find((s) => isCurrentPath(currentPath, s.spec.url));

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
    if (expanded && currentFolder.subScopeName) {
      // Only fetch if folder is empty (hasn't been loaded yet)
      const isEmpty =
        Object.keys(currentFolder.folders).length === 0 && Object.keys(currentFolder.suggestedNavigations).length === 0;

      if (!isEmpty) {
        // Folder already has content, skip fetching
        this.updateState({ folders, filteredFolders });
        return;
      }

      // Set loading state for this folder
      currentFolder.loading = true;
      currentFilteredFolder.loading = true;
      // Extract the subScope name from the folder (stored when folder was created)
      const subScopeName = currentFolder.subScopeName || name;
      // Fetch asynchronously without blocking the state update
      this.fetchSubScopeItems(path, subScopeName);
    } else if (!expanded) {
      // Clear loading state when collapsing
      currentFolder.loading = false;
      currentFilteredFolder.loading = false;
    }

    this.updateState({ folders, filteredFolders });
  };

  private fetchSubScopeItems = async (path: string[], subScopeName: string) => {
    // Check if folder already has content - skip fetching to preserve existing state
    const targetFolder = this.getFolder(path);
    if (
      targetFolder &&
      (Object.keys(targetFolder.folders).length > 0 || Object.keys(targetFolder.suggestedNavigations).length > 0)
    ) {
      return;
    }

    let subScopeFolders: SuggestedNavigationsFoldersMap | undefined;

    try {
      // Fetch navigations for this subScope.
      // path includes the root key ('') at index 0, so path.length - 1 gives the
      // nesting depth: ['', folderA] → depth 1, ['', folderA, folderB] → depth 2.
      // rootScope is always the top-level scope (forScopeNames[0]), regardless of UI
      // navigation state — it identifies the root of the navigation tree being built.
      const rootScope = this.state.forScopeNames[0];
      const depth = path.length - 1;
      const subScopeItems = await this.apiClient.fetchScopeNavigations([subScopeName], {
        ...(depth > 0 && { depth }),
        ...(rootScope && { rootScope }),
      });

      // Filter out items that have a subScope matching any subScope already in the path
      // This prevents infinite loops when a subScope returns items with the same subScope
      const filteredItems = filterItemsWithSubScopesInPath(subScopeItems, path, subScopeName, this.state.folders);

      // Group the items and add them to the subScope folder
      subScopeFolders = this.groupSuggestedItems(filteredItems);
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

      this.updateState({ folders, filteredFolders });

      // Preload children for any newly added folders with preLoadSubScopeChildren
      this.preloadSubScopeChildren(rootSubScopeFolder.folders, path);
    } else {
      this.updateState({ folders, filteredFolders });
    }
  };

  // Helper to get a folder at a given path
  private getFolder = (path: string[]): SuggestedNavigationsFolder | undefined => {
    let folder: SuggestedNavigationsFoldersMap = this.state.folders;
    for (let i = 0; i < path.length - 1; i++) {
      folder = folder[path[i]]?.folders ?? {};
    }
    return folder[path[path.length - 1]];
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
        scopeNavigations: [],
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        loading: false,
        drawerOpened: false,
      });

      return;
    }

    this.updateState({ forScopeNames, loading: true });

    const res = await this.apiClient.fetchScopeNavigations(forScopeNames);

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

      // Preload children for folders with preLoadSubScopeChildren set
      this.preloadSubScopeChildren(folders[''].folders, ['']);
    }
  };

  /**
   * Preloads children for folders that have preLoadSubScopeChildren set to true.
   * This fetches the subScope items immediately when the navigation is first loaded,
   * or when a parent subScope folder is fetched.
   * @param foldersToCheck - The folders to check for preLoadSubScopeChildren
   * @param basePath - The path to prepend when building the full path for each folder
   */
  private preloadSubScopeChildren = (foldersToCheck: SuggestedNavigationsFoldersMap, basePath: string[]) => {
    for (const [folderKey, folder] of Object.entries(foldersToCheck)) {
      if (folder.preLoadSubScopeChildren && folder.subScopeName) {
        const path = [...basePath, folderKey];
        this.fetchSubScopeItems(path, folder.subScopeName);
      }
    }
  };

  public groupSuggestedItems = (navigationItems: ScopeNavigation[]): SuggestedNavigationsFoldersMap => {
    const currentPath = locationService.getLocation().pathname;

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
      const subScope = navigation.spec.subScope;

      // If the current URL matches an item, expand the parent folders.
      const expanded = currentPath.startsWith(navigation.spec.url);

      // Helper function to add navigation item to a target
      const addNavigationToTarget = (target: SuggestedNavigationsMap) => {
        if (!target[navigation.spec.url]) {
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
        const navigationTitle = navigation.status.title || navigation.metadata.name;

        // Create a separate folder for each item, using a unique key
        // All folders with the same subScope will load the same content when expanded
        const folderKey = `${subScope}-${navigation.metadata.name}`;
        if (!rootNode.folders[folderKey]) {
          const { disableSubScopeSelection, preLoadSubScopeChildren } = navigation.spec;
          rootNode.folders[folderKey] = {
            title: navigationTitle,
            expanded,
            folders: {},
            suggestedNavigations: {},
            subScopeName: subScope,
            disableSubScopeSelection,
            preLoadSubScopeChildren,
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

/**
 * Filters out navigation items that have a subScope matching any subScope already in the path.
 * This prevents infinite loops when a subScope returns items with the same subScope.
 * @param items - The navigation items to filter
 * @param path - The folder path to check for existing subScopes
 * @param currentSubScope - The subScope currently being expanded
 * @param folders - The folder structure to traverse
 * @returns Filtered items without subScopes that would create infinite loops
 */
export function filterItemsWithSubScopesInPath(
  items: ScopeNavigation[],
  path: string[],
  currentSubScope: string,
  folders: SuggestedNavigationsFoldersMap
): ScopeNavigation[] {
  const subScopesInPath = new Set<string>();
  // Include the current subScope being expanded
  subScopesInPath.add(currentSubScope);

  // Traverse the path and collect all subScope names
  let currentLevelFolders: SuggestedNavigationsFoldersMap = folders;
  for (const folderKey of path) {
    const folder = currentLevelFolders[folderKey];
    if (folder?.subScopeName) {
      subScopesInPath.add(folder.subScopeName);
    }
    if (folder) {
      currentLevelFolders = folder.folders;
    } else {
      // If folder is not found, break to avoid errors
      break;
    }
  }

  return items.filter((item) => {
    const itemSubScope = item.spec.subScope;
    return !itemSubScope || !subScopesInPath.has(itemSubScope);
  });
}
