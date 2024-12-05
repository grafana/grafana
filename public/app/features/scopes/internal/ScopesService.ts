import { BehaviorSubject, pairwise } from 'rxjs';

import { Scope } from '@grafana/data';
import { ScopesContextValue } from '@grafana/scenes';

import { getScopesSelectorService } from '../services';

export interface State {
  isEnabled: boolean;
  isLoading: boolean;
  isReadOnly: boolean;
  value: Scope[];
}

export const getInitialState = (): State => ({
  isEnabled: false,
  isLoading: false,
  isReadOnly: false,
  value: [],
});

export class ScopesService implements ScopesContextValue {
  private _state = new BehaviorSubject<State>(getInitialState());

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public changeScopes = (scopeNames: string[]) => {
    return getScopesSelectorService()?.applyNewScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));
  };

  public setScopes = (scopes: Scope[]) => {
    this.updateState({ value: scopes });
  };

  public enterLoadingMode = () => {
    this.updateState({ isLoading: true });
  };

  public exitLoadingMode = () => {
    this.updateState({ isLoading: false });
  };

  public enterReadOnly = () => {
    this.updateState({ isReadOnly: true });

    if (getScopesSelectorService()?.state.isOpened) {
      getScopesSelectorService()?.closePicker();
    }
  };

  public exitReadOnly = () => {
    this.updateState({ isReadOnly: false });
  };

  public enable = () => {
    this.updateState({ isEnabled: true });
  };

  public disable = () => {
    this.updateState({ isEnabled: false });
  };

  public subscribeToState = (cb: (newState: State, prevState: State) => void) => {
    return this._state.pipe(pairwise()).subscribe(([prevState, newState]) => cb(newState, prevState));
  };

  private updateState = (newState: Partial<State>) => {
    this._state.next({ ...this.state, ...newState });
  };
}
