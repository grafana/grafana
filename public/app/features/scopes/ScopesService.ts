import { Scope } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ScopesContextValue } from '@grafana/scenes';

import { ScopesServiceBase } from './ScopesServiceBase';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

export class ScopesService extends ScopesServiceBase<ScopesContextValue['state']> implements ScopesContextValue {
  static #instance: ScopesService | undefined = undefined;

  private constructor() {
    super({
      isDrawerOpened: false,
      isEnabled: false,
      isLoading: false,
      isReadOnly: false,
      value: [],
    });
  }

  public static get instance(): ScopesService | undefined {
    if (!ScopesService.#instance && config.featureToggles.scopeFilters) {
      ScopesService.#instance = new ScopesService();
    }

    return ScopesService.#instance;
  }

  public changeScopes = (scopeNames: string[]) => {
    return ScopesSelectorService.instance?.applyNewScopes(scopeNames.map((scopeName) => ({ scopeName, path: [] })));
  };

  public setScopes = (scopes: Scope[]) => {
    this.updateState({ value: scopes });
  };

  public enterLoadingMode = () => {
    if (!this.state.isLoading) {
      this.updateState({ isLoading: true });
    }
  };

  public exitLoadingMode = () => {
    if (this.state.isLoading) {
      this.updateState({ isLoading: false });
    }
  };

  public enterReadOnly = () => {
    if (!this.state.isReadOnly) {
      this.updateState({ isReadOnly: true });
    }

    if (ScopesSelectorService.instance?.state.isOpened) {
      ScopesSelectorService.instance?.closePicker();
    }
  };

  public exitReadOnly = () => {
    if (this.state.isReadOnly) {
      this.updateState({ isReadOnly: false });
    }
  };

  public toggleDrawer = () => {
    this.updateState({ isDrawerOpened: !this.state.isDrawerOpened });
  };

  public enable = () => {
    if (!this.state.isEnabled) {
      this.updateState({ isEnabled: true });
    }
  };

  public disable = () => {
    if (this.state.isEnabled) {
      this.updateState({ isEnabled: false });
    }
  };
}
