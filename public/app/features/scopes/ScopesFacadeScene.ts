import { getScopesDashboardsService, getScopesSelectorService } from '@grafana/runtime';
import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

interface ScopesFacadeState extends SceneObjectState {
  // A callback that will be executed when new scopes are set
  handler?: (facade: ScopesFacade) => void;
}

export class ScopesFacade extends SceneObjectBase<ScopesFacadeState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  public constructor(state: ScopesFacadeState) {
    super(state);

    this.addActivationHandler(this._activationHandler);
  }

  public getUrlState() {
    return {
      scopes: this.value.map(({ metadata }) => metadata.name),
    };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (!values.scopes && !getScopesSelectorService().state.isEnabled) {
      return;
    }

    let scopeNames = values.scopes ?? [];
    scopeNames = Array.isArray(scopeNames) ? scopeNames : [scopeNames];

    getScopesSelectorService().updateScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));
  }

  private _activationHandler = () => {
    this.enable();

    this._subs.add(
      getScopesSelectorService().stateObservable.subscribe(() => {
        this.forceRender();
      })
    );

    return () => {
      this.disable();
    };
  };

  public get value() {
    return getScopesSelectorService().state.scopes.map(({ scope }) => scope);
  }

  public enable() {
    getScopesSelectorService().enable();
    getScopesDashboardsService().enable();
  }

  public disable() {
    getScopesSelectorService().disable();
    getScopesDashboardsService().disable();
  }

  public enterReadOnly() {
    getScopesSelectorService().enterReadOnly();
    getScopesDashboardsService().enterReadOnly();
  }

  public exitReadOnly() {
    getScopesSelectorService().exitReadOnly();
    getScopesDashboardsService().exitReadOnly();
  }
}
