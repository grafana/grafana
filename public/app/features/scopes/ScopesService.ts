import { isEqual } from 'lodash';
import { BehaviorSubject, Observable, combineLatest, Subscription } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';

import { LocationService, ScopesContextValue, ScopesContextValueState } from '@grafana/runtime';

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

  private subscriptions: Subscription[] = [];

  constructor(
    private selectorService: ScopesSelectorService,
    private dashboardsService: ScopesDashboardsService,
    private locationService: LocationService
  ) {
    this._state = new BehaviorSubject<State>({
      enabled: false,
      readOnly: false,
    });

    this._stateObservable = new BehaviorSubject({
      ...this._state.getValue(),
      value: this.selectorService.state.appliedScopes
        .map((s) => this.selectorService.state.scopes[s.scopeId])
        // Filter out scopes if we don't have actual scope data loaded yet
        .filter((s) => s),
      loading: this.selectorService.state.loading,
      drawerOpened: this.dashboardsService.state.drawerOpened,
    });

    // We combine the latest emissions from this state + selectorService + dashboardsService.
    this.subscriptions.push(
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
        .subscribe(this._stateObservable)
    );

    // Init from the URL when we first load
    const queryParams = new URLSearchParams(locationService.getLocation().search);
    const scopeNodeId = queryParams.get('scope_node');
    // scope_parent is for backward compatibility only
    const parentNodeId = queryParams.get('scope_parent');

    this.changeScopes(queryParams.getAll('scopes'), parentNodeId ?? undefined, scopeNodeId ?? undefined);

    // Pre-load scope node (which loads parent too) or fallback to parent node for old URLs
    const nodeToPreload = scopeNodeId ?? parentNodeId;
    if (nodeToPreload) {
      this.selectorService.resolvePathToRoot(nodeToPreload, this.selectorService.state.tree!).catch((error) => {
        console.error('Failed to pre-load node path', error);
      });
    }

    // Update scopes state based on URL.
    this.subscriptions.push(
      locationService.getLocationObservable().subscribe((location) => {
        if (!this.state.enabled) {
          // We don't need to react on pages that don't interact with scopes.
          return;
        }
        const queryParams = new URLSearchParams(location.search);

        const scopes = queryParams.getAll('scopes');
        const scopeNodeId = queryParams.get('scope_node');
        // scope_parent is for backward compatibility only
        const parentNodeId = queryParams.get('scope_parent');

        // Check if new scopes are different from the old scopes
        const currentScopes = this.selectorService.state.appliedScopes.map((scope) => scope.scopeId);
        if (scopes.length && !isEqual(scopes, currentScopes)) {
          // We only update scopes but never delete them. This is to keep the scopes in memory if user navigates to
          // page that does not use scopes (like from dashboard to dashboard list back to dashboard). If user
          // changes the URL directly, it would trigger a reload so scopes would still be reset.
          this.changeScopes(scopes, parentNodeId ?? undefined, scopeNodeId ?? undefined);
        }
      })
    );

    // Update the URL based on change in the scopes state
    this.subscriptions.push(
      selectorService.subscribeToState((state, prevState) => {
        const oldScopeNodeId = prevState.appliedScopes[0]?.scopeNodeId;
        const newScopeNodeId = state.appliedScopes[0]?.scopeNodeId;

        const oldScopeNames = prevState.appliedScopes.map((scope) => scope.scopeId);
        const newScopeNames = state.appliedScopes.map((scope) => scope.scopeId);

        const scopesChanged = !isEqual(oldScopeNames, newScopeNames);
        const scopeNodeChanged = oldScopeNodeId !== newScopeNodeId;

        if (scopesChanged || scopeNodeChanged) {
          this.locationService.partial(
            {
              scopes: newScopeNames,
              scope_node: newScopeNodeId || null,
              scope_parent: null,
            },
            true
          );
        }
      })
    );
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

  public changeScopes = (scopeNames: string[], parentNodeId?: string, scopeNodeId?: string) =>
    this.selectorService.changeScopes(scopeNames, parentNodeId, scopeNodeId);

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
      if (enabled) {
        const scopeNodeId = this.selectorService.state.appliedScopes[0]?.scopeNodeId;
        this.locationService.partial(
          {
            scopes: this.selectorService.state.appliedScopes.map((s) => s.scopeId),
            scope_node: scopeNodeId,
            scope_parent: null,
          },
          true
        );
      }
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
        selectedScopes: state.appliedScopes
          .map((s) => state.scopes[s.scopeId])
          // Filter out scopes if we don't have actual scope data loaded yet
          .filter((s) => s),
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

  /**
   * Cleanup subscriptions so this can be garbage collected.
   */
  public cleanUp() {
    for (const sub of this.subscriptions) {
      sub.unsubscribe();
    }
  }
}
