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
 * The ScopesService is mainly an aggregation of the ScopesSelectorService and ScopesDashboardsService which handle
 * the scope selection mechanics and then loading and showing related dashboards. We aggregate the state of these
 * here in single service to serve as a public facade we can later publish through the grafana/runtime to plugins.
 */
export class ScopesService implements ScopesContextValue {
  // Only internal part of the state.
  private readonly _state: BehaviorSubject<State>;

  // This will contain the combined state that will be public.
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
      this.getSelectorServiceStateObservable(),
      this.getDashboardsServiceStateObservable(),
    ])
      .pipe(
        // Map the 3 states into single ScopesContextValueState object
        map(
          ([thisState, selectorState, dashboardsState]): ScopesContextValueState => ({
            ...thisState,
            value: selectorState.selectedScopes,
            loading: selectorState.loading,
            drawerOpened: dashboardsState.drawerOpened,
          })
        )
      )
      // We pass this into behaviourSubject so we get the 1 event buffer and we can access latest value.
      .subscribe(this._stateObservable);
  }

  /**
   * This updates only the internal state of this service.
   * @param newState
   */
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

  /**
   * Returns observable that emits when relevant parts of the selectorService state change.
   * @private
   */
  private getSelectorServiceStateObservable() {
    return this.selectorService.stateObservable.pipe(
      map((state) => ({
        // We only need these 2 properties from the selectorService state.
        // We do mapping here but mainly to make the distinctUntilChanged simpler
        selectedScopes: state.selectedScopes.map(({ scope }) => scope),
        loading: state.loading,
      })),
      distinctUntilChanged(
        (prev, curr) => prev.loading === curr.loading && isEqual(prev.selectedScopes, curr.selectedScopes)
      )
    );
  }

  /**
   * Returns observable that emits when relevant parts of the dashboardService state change.
   * @private
   */
  private getDashboardsServiceStateObservable() {
    return this.dashboardsService.stateObservable.pipe(
      distinctUntilChanged((prev, curr) => prev.drawerOpened === curr.drawerOpened)
    );
  }
}
