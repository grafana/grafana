import { BehaviorSubject } from 'rxjs';

import { Scope } from '@grafana/data';
import { ScopesContextValue } from '@grafana/runtime';

export interface State {
  isEnabled: boolean;
  isLoading: boolean;
  isReadOnly: boolean;
  pendingScopes: string[] | null;
  value: Scope[];
}

export const getInitialState = (): State => ({
  isEnabled: false,
  isLoading: false,
  isReadOnly: false,
  pendingScopes: null,
  value: [],
});

export class ScopesService implements ScopesContextValue {
  private _state = new BehaviorSubject<State>(getInitialState());
  private prevState = getInitialState();

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public setNewScopes = (scopeNames: string[] | null) => {
    this.updateState({ pendingScopes: scopeNames });
  };

  public setCurrentScopes = (scopes: Scope[]) => {
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
    return this._state.subscribe((newState) => cb(newState, this.prevState));
  };

  private updateState = (newState: Partial<State>) => {
    this.prevState = this.state;
    this._state.next({ ...this.state, ...newState });
  };
}
