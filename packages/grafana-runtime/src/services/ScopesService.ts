import { BehaviorSubject } from 'rxjs';

import { Scope } from '@grafana/data';

export interface State {
  isEnabled: boolean;
  isLoading: boolean;
  isDrawerOpened: boolean;
  isPickerOpened: boolean;
  isReadOnly: boolean;
  pendingScopes: string[] | null;
  value: Scope[];
}

export const getInitialState = (): State => ({
  isEnabled: false,
  isLoading: false,
  isDrawerOpened: false,
  isPickerOpened: false,
  isReadOnly: false,
  pendingScopes: null,
  value: [],
});

export class ScopesService {
  private _state = new BehaviorSubject<State>(getInitialState());

  public get state() {
    return this._state.getValue();
  }

  public get stateObservable() {
    return this._state.asObservable();
  }

  public setNewScopes(scopeNames: string[] | null) {
    this.updateState({ pendingScopes: scopeNames });
  }

  public setCurrentScopes(scopes: Scope[]) {
    this.updateState({ value: scopes });
  }

  public enterLoadingMode() {
    this.updateState({ isLoading: true });
  }

  public exitLoadingMode() {
    this.updateState({ isLoading: false });
  }

  public enterReadOnly() {
    this.updateState({ isReadOnly: true, isPickerOpened: false });
  }

  public exitReadOnly() {
    this.updateState({ isReadOnly: false });
  }

  public enable() {
    this.updateState({ isEnabled: true });
  }

  public disable() {
    this.updateState({ isEnabled: false });
  }

  public openPicker() {
    this.updateState({ isPickerOpened: true });
  }

  public closePicker() {
    this.updateState({ isPickerOpened: false });
  }

  public openDrawer() {
    this.updateState({ isDrawerOpened: true });
  }

  public closeDrawer() {
    this.updateState({ isDrawerOpened: false });
  }

  public toggleDrawer() {
    this.updateState({ isDrawerOpened: !this.state.isDrawerOpened });
  }

  public resetState() {
    this._state.next(getInitialState());
  }

  private updateState(newState: Partial<State>) {
    this._state.next({ ...this.state, ...newState });
  }
}

export const scopesService = new ScopesService();
