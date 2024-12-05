import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

import { getScopesService } from './services';

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
    if (!values.scopes && !getScopesService()?.state.isEnabled) {
      return;
    }

    let scopeNames = values.scopes ?? [];
    scopeNames = Array.isArray(scopeNames) ? scopeNames : [scopeNames];

    getScopesService()?.changeScopes(scopeNames);
  }

  private _activationHandler = () => {
    this.enable();

    this._subs.add(
      getScopesService()?.subscribeToState((newState, prevState) => {
        if (newState.value !== prevState.value) {
          this.forceRender();
          this.state.handler?.(this);
        }
      })
    );

    return () => {
      this.disable();
    };
  };

  public get value() {
    return getScopesService()?.state.value ?? [];
  }

  public enable() {
    getScopesService()?.enable();
  }

  public disable() {
    getScopesService()?.disable();
  }

  public enterReadOnly() {
    getScopesService()?.enterReadOnly();
  }

  public exitReadOnly() {
    getScopesService()?.exitReadOnly();
  }
}
