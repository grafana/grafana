import { isEqual } from 'lodash';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { ScopesContextValue, ScopesContextValueState } from '@grafana/runtime';

import { ScopesDashboardsService } from './dashboards/ScopesDashboardsService';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

export interface State {
  enabled: boolean;
  readOnly: boolean;
}

/**
 * The ScopesService is mainly an aggregation of the ScopesSelectorService and ScopesDashboardsService which hande
 * the scope selection mechanics and then loading and showing related dashboards. We aggregate the state of these
 * here in single service to serve as a public facade we can later publish through the grafana/runtime to plugins.
 */
export class ScopesService implements ScopesContextValue {
  private readonly _state: BehaviorSubject<State>;
  private readonly _stateObservable: BehaviorSubject<ScopesContextValueState>;

  constructor(
    private selectorService: ScopesSelectorService,
    private dashboardsService: ScopesDashboardsService
  ) {
    this._state = new BehaviorSubject<State>({
      enabled: false,
      readOnly: false,
    });

    this._stateObservable = new BehaviorSubject({
      ...this._state.getValue(),
      value: this.selectorService.state.selectedScopes.map(({ scope }) => scope),
      loading: this.selectorService.state.loading,
      drawerOpened: this.dashboardsService.state.drawerOpened,
    });

    // We combine the latest emissions from this state + selectorService + dashboardsService.
    combineLatest([
      this._state.asObservable(),
      // As selectorService state is bigger than we need here, we map what we need and make sure it only emits when
      // things we use here change.
      this.selectorService.stateObservable.pipe(
        map((state) => ({
          selectedScopes: state.selectedScopes.map(({ scope }) => scope),
          loading: state.loading,
        })),
        distinctUntilChanged(
          (prev, curr) => prev.loading === curr.loading && isEqual(prev.selectedScopes, curr.selectedScopes)
        )
      ),
      // Same here we want only relevant changes to be emitted.
      this.dashboardsService.stateObservable.pipe(
        distinctUntilChanged((prev, curr) => prev.drawerOpened === curr.drawerOpened)
      ),
    ])
      .pipe(
        // Then we combine the two event states into single ScopesContextValueState object
        map(
          ([thisState, selectorState, dashboardsState]): ScopesContextValueState => ({
            ...thisState,
            value: selectorState.selectedScopes,
            loading: selectorState.loading,
            drawerOpened: dashboardsState.drawerOpened,
          })
        )
      )
      .subscribe(this._stateObservable);
  }

  private updateState = (newState: Partial<State>) => {
    this._state.next({ ...this._state.getValue(), ...newState });
  };

  /**
   * The state of this service is a combination of the downstream services state plus the state of this service.
   */
  public get state(): ScopesContextValueState {
    // As a side effect this also gives us memoizeOne on this so it should be safe to use in react without unnecessary
    // rerenders.
    return this._stateObservable.value;
  }

  public get stateObservable(): Observable<ScopesContextValueState> {
    return this._stateObservable;
  }

  public changeScopes = (scopeNames: string[]) => this.selectorService.changeScopes(scopeNames);

  public setReadOnly = (readOnly: boolean) => {
    if (this.state.readOnly !== readOnly) {
      this.updateState({ readOnly });
    }

    if (readOnly && this.selectorService.state.opened) {
      this.selectorService.closeAndReset();
    }
  };

  public setEnabled = (enabled: boolean) => {
    if (this.state.enabled !== enabled) {
      this.updateState({ enabled });
    }
  };

  public toggleDrawer = () => this.dashboardsService.setDrawerOpened(!this.dashboardsService.state.drawerOpened);
}
