import { isEqual } from 'lodash';

import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
  SceneObjectWithUrlSync,
} from '@grafana/scenes';

import { scopesSelectorScene } from './instance';
import { disableScopes, enableScopes, enterScopesReadOnly, exitScopesReadOnly, getSelectedScopes } from './utils';

interface ScopesFacadeState extends SceneObjectState {
  // A callback that will be executed when new scopes are set
  handler?: (facade: ScopesFacade) => void;
  // The render count is a workaround to force the URL sync manager to update the URL with the latest scopes
  // Basically it starts at 0, and it is increased with every scopes value update
  renderCount?: number;
}

export class ScopesFacade extends SceneObjectBase<ScopesFacadeState> implements SceneObjectWithUrlSync {
  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['scopes'] });

  public constructor(state: ScopesFacadeState) {
    super({
      ...state,
      renderCount: 0,
    });

    this.addActivationHandler(this._activationHandler);
  }

  public getUrlState() {
    return {
      scopes: this.value.map(({ metadata }) => metadata.name),
    };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (!values.scopes && !scopesSelectorScene?.state.isEnabled) {
      return;
    }

    let scopeNames = values.scopes ?? [];
    scopeNames = Array.isArray(scopeNames) ? scopeNames : [scopeNames];

    scopesSelectorScene?.updateScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));
  }

  private _activationHandler = () => {
    this.enable();

    this._subs.add(
      scopesSelectorScene?.subscribeToState((newState, prevState) => {
        if (!newState.isLoadingScopes && (prevState.isLoadingScopes || !isEqual(newState.scopes, prevState.scopes))) {
          this.setState({ renderCount: (this.state.renderCount ?? 0) + 1 });
          this.state.handler?.(this);
        }
      })
    );

    return () => {
      this.disable();
    };
  };

  public get value() {
    return getSelectedScopes();
  }

  public enable() {
    enableScopes();
  }

  public disable() {
    disableScopes();
  }

  public enterReadOnly() {
    enterScopesReadOnly();
  }

  public exitReadOnly() {
    exitScopesReadOnly();
  }
}
