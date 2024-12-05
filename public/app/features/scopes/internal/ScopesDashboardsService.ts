import { isEqual } from 'lodash';
import { BehaviorSubject, from, Subscription } from 'rxjs';
import { finalize, pairwise } from 'rxjs/operators';

import { ScopeDashboardBinding } from '@grafana/data';

import { getScopesService } from '../services';

import { fetchDashboards } from './api';
import { SuggestedDashboardsFoldersMap } from './types';
import { filterFolders, groupDashboards } from './utils';

export interface State {
  // by keeping a track of the raw response, it's much easier to check if we got any dashboards for the currently selected scopes
  dashboards: ScopeDashboardBinding[];
  // a filtered version of the `folders` property. this prevents a lot of unnecessary parsings in React renders
  filteredFolders: SuggestedDashboardsFoldersMap;
  // this is a grouping in folders of the `dashboards` property. it is used for filtering the dashboards and folders when the search query changes
  folders: SuggestedDashboardsFoldersMap;
  forScopeNames: string[];
  isLoading: boolean;
  isOpened: boolean;
  searchQuery: string;
}

const getInitialState = (): State => ({
  dashboards: [],
  filteredFolders: {},
  folders: {},
  forScopeNames: [],
  isLoading: false,
  isOpened: false,
  searchQuery: '',
});

export class ScopesDashboardsService {
  private _state = new BehaviorSubject(getInitialState());

  private dashboardsFetchingSub: Subscription | undefined;

  constructor() {
    getScopesService()?.subscribeToState((newState, prevState) => {
      if (newState.value !== prevState.value) {
        this.fetchDashboards(newState.value.map((scope) => scope.metadata.name));
      }
    });
  }

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public updateFolder = (path: string[], isExpanded: boolean) => {
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
  };

  public changeSearchQuery = (searchQuery: string) => {
    searchQuery = searchQuery ?? '';

    const filteredFolders = filterFolders(this.state.folders, searchQuery);

    this.updateState({ filteredFolders, searchQuery });
  };

  public clearSearchQuery = () => {
    this.changeSearchQuery('');
  };

  public toggleDrawer = () => {
    this.updateState({ isOpened: !this.state.isOpened });
  };

  public fetchDashboards = async (forScopeNames: string[]) => {
    if (isEqual(this.state.forScopeNames, forScopeNames)) {
      return;
    }

    this.dashboardsFetchingSub?.unsubscribe();

    if (forScopeNames.length === 0) {
      this.updateState({
        dashboards: [],
        filteredFolders: {},
        folders: {},
        forScopeNames: [],
        isLoading: false,
        isOpened: false,
      });

      return;
    }

    this.updateState({ forScopeNames, isLoading: true });

    this.dashboardsFetchingSub = from(fetchDashboards(forScopeNames))
      .pipe(
        finalize(() => {
          this.updateState({ isLoading: false });
        })
      )
      .subscribe((dashboards) => {
        const folders = groupDashboards(dashboards);
        const filteredFolders = filterFolders(folders, this.state.searchQuery);

        this.updateState({ dashboards, filteredFolders, folders, isLoading: false, isOpened: true });

        this.dashboardsFetchingSub?.unsubscribe();
      });
  };

  public subscribeToState = (cb: (newState: State, prevState: State) => void) => {
    return this._state.pipe(pairwise()).subscribe(([prevState, newState]) => cb(newState, prevState));
  };

  private updateState = (newState: Partial<State>) => {
    this._state.next({ ...this._state.getValue(), ...newState });
  };
}
