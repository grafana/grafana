import { scopesService } from '@grafana/runtime';
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
    if (!values.scopes && !scopesService.state.isEnabled) {
      return;
    }

    let scopeNames = values.scopes ?? [];
    scopeNames = Array.isArray(scopeNames) ? scopeNames : [scopeNames];

    scopesService.setNewScopes(scopeNames);
  }

  private _activationHandler = () => {
    this.enable();

    this._subs.add(
      scopesService.stateObservable.subscribe(() => {
        this.forceRender();
      })
    );

    return () => {
      this.disable();
    };
  };

  public get value() {
    return scopesService.state.value;
  }

  public enable() {
    scopesService.enable();
  }

  public disable() {
    scopesService.disable();
  }

  public enterReadOnly() {
    scopesService.enterReadOnly();
  }

  public exitReadOnly() {
    scopesService.exitReadOnly();
  }
}
