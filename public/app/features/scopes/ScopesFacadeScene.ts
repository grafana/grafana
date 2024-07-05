import { Scope } from '@grafana/data';
import { SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { scopesScene } from './instance';

interface ScopesFacadeState extends SceneObjectState {
  // A callback that will be executed when new scopes are set
  handler?: (scopes: Scope[]) => void;

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
      scopesScene?.show();
    }

    this._subs.add(
      scopesScene?.subscribeToSelectedScopes((scopes) => {
        this.state.handler?.(scopes);
      })
    );

    return () => {
      scopesScene?.hide();
    };
  };

  public show() {
    scopesScene?.show();
  }

  public hide() {
    scopesScene?.hide();
  }

  public get value() {
    return scopesScene?.getSelectedScopes() ?? [];
  }

  public enterViewMode() {
    scopesScene?.enterViewMode();
  }

  public exitViewMode() {
    scopesScene?.exitViewMode();
  }
}
