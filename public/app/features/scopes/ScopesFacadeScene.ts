import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { scopesFiltersScene } from './instance';
import { disableScopes, enableScopes, enterScopesReadOnly, exitScopesReadOnly, getSelectedScopes } from './utils';

interface ScopesFacadeState extends SceneObjectState {
  // A callback that will be executed when new scopes are set
  handler?: (facade: ScopesFacade) => void;

  // Prevent rendering the selector by default
  disabled?: boolean;
}

export class ScopesFacade extends SceneObjectBase<ScopesFacadeState> {
  public constructor(state: ScopesFacadeState) {
    super(state);

    this.addActivationHandler(this._activationHandler);
  }

  private _activationHandler = () => {
    if (!this.state.disabled) {
      this.enable();
    }

    this._subs.add(
      scopesFiltersScene?.subscribeToState((newState, prevState) => {
        if (!newState.isLoadingScopes && (prevState.isLoadingScopes || newState.scopes !== prevState.scopes)) {
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
