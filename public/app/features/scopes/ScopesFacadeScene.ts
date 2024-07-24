import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { scopesFiltersScene } from './instance';
import { disableScopes, enableScopes, getSelectedScopes, hideScopes, showScopes } from './utils';

interface ScopesFacadeState extends SceneObjectState {
  // A callback that will be executed when new scopes are set
  handler?: (facade: ScopesFacade) => void;

  // Prevent rendering the selector by default
  hidden?: boolean;
}

export class ScopesFacade extends SceneObjectBase<ScopesFacadeState> {
  public constructor(state: ScopesFacadeState) {
    super(state);

    this.addActivationHandler(this._activationHandler);
  }

  private _activationHandler = () => {
    if (!this.state.hidden) {
      this.show();
    }

    this._subs.add(
      scopesFiltersScene?.subscribeToState((newState, prevState) => {
        if (!newState.isLoadingScopes && (prevState.isLoadingScopes || newState.scopes !== prevState.scopes)) {
          this.state.handler?.(this);
        }
      })
    );

    return () => {
      this.hide();
    };
  };

  public get value() {
    return getSelectedScopes();
  }

  public show() {
    showScopes();
  }

  public hide() {
    hideScopes();
  }

  public disable() {
    disableScopes();
  }

  public enable() {
    enableScopes();
  }
}
