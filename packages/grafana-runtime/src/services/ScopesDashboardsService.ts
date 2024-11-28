import { isEqual } from 'lodash';
import { BehaviorSubject } from 'rxjs';

import { ScopeDashboardBinding, SuggestedDashboardsFoldersMap } from '@grafana/data';

import { config } from '../config';

import { getBackendSrv } from './backendSrv';

export interface ScopesDashboardsServiceState {
  // by keeping a track of the raw response, it's much easier to check if we got any dashboards for the currently selected scopes
  dashboards: ScopeDashboardBinding[];
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: SuggestedDashboardsFoldersMap;
  // this is a grouping in folders of the `dashboards` property. it is used for filtering the dashboards and folders when the search query changes
  folders: SuggestedDashboardsFoldersMap;
  forScopeNames: string[];
  isEnabled: boolean;
  isLoading: boolean;
  isOpened: boolean;
  isReadOnly: boolean;
  searchQuery: string;
}

const getInitialState = (): ScopesDashboardsServiceState => ({
  dashboards: [],
  folders: {},
  filteredFolders: {},
  forScopeNames: [],
  isLoading: false,
  isOpened: false,
  isEnabled: false,
  isReadOnly: false,
  searchQuery: '',
});

export class ScopesDashboardsService {
  private _state: BehaviorSubject<ScopesDashboardsServiceState>;

  public constructor() {
    this._state = new BehaviorSubject<ScopesDashboardsServiceState>(getInitialState());
  }

  public reset() {
    this.updateState(getInitialState());
  }

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public async fetchDashboards(scopeNames: string[]) {
    if (isEqual(this.state.forScopeNames, scopeNames)) {
      return;
    }

    if (scopeNames.length === 0) {
      return this.updateState({
        dashboards: [],
        folders: {},
        filteredFolders: {},
        forScopeNames: [],
        isLoading: false,
        isOpened: false,
      });
    }

    this.updateState({ forScopeNames: scopeNames, isLoading: true });

    const dashboards = await this.fetchDashboardsApi(scopeNames);

    const folders = groupDashboards(dashboards);
    const filteredFolders = filterFolders(folders, this.state.searchQuery);

    this.updateState({
      dashboards,
      folders,
      filteredFolders,
      isLoading: false,
      isOpened: scopeNames.length > 0,
    });
  }

  public clearSearchQuery() {
    this.changeSearchQuery('');
  }

  public changeSearchQuery(searchQuery: string) {
    searchQuery = searchQuery ?? '';

    this.updateState({
      filteredFolders: filterFolders(this.state.folders, searchQuery),
      searchQuery,
    });
  }

  public updateFolder(path: string[], isExpanded: boolean) {
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

    currentFolder.isExpanded = isExpanded;
    currentFilteredFolder.isExpanded = isExpanded;

    this.updateState({ folders, filteredFolders });
  }

  public togglePanel() {
    if (this.state.isOpened) {
      this.closePanel();
    } else {
      this.openPanel();
    }
  }

  public openPanel() {
    if (this.state.isOpened) {
      return;
    }

    this.updateState({ isOpened: true });
  }

  public closePanel() {
    if (!this.state.isOpened) {
      return;
    }

    this.updateState({ isOpened: false });
  }

  public enable() {
    this.updateState({ isEnabled: true });
  }

  public disable() {
    this.updateState({ isEnabled: false });
  }

  public enterReadOnly() {
    this.updateState({ isReadOnly: true });
  }

  public exitReadOnly() {
    this.updateState({ isReadOnly: false });
  }

  public async fetchDashboardsApi(scopeNames: string[]): Promise<ScopeDashboardBinding[]> {
    try {
      const response = await getBackendSrv().get<{ items: ScopeDashboardBinding[] }>(
        `/apis/scope.grafana.app/v0alpha1/namespaces/${config.namespace ?? 'default'}/find/scope_dashboard_bindings`,
        {
          scope: scopeNames,
        }
      );

      return response?.items ?? [];
    } catch (err) {
      return [];
    }
  }

  private updateState(newState: Partial<ScopesDashboardsServiceState>) {
    this._state.next({ ...this.state, ...newState });
  }
}

export function filterFolders(folders: SuggestedDashboardsFoldersMap, query: string): SuggestedDashboardsFoldersMap {
  query = (query ?? '').toLowerCase();

  return Object.entries(folders).reduce<SuggestedDashboardsFoldersMap>((acc, [folderId, folder]) => {
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

export function groupDashboards(dashboards: ScopeDashboardBinding[]): SuggestedDashboardsFoldersMap {
  return dashboards.reduce<SuggestedDashboardsFoldersMap>(
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
