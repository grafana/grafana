import { Scope } from '@grafana/data';
import { config } from '@grafana/runtime';
import { ScopesContextValue } from '@grafana/scenes';

import { ScopesServiceBase } from './ScopesServiceBase';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

export class ScopesService extends ScopesServiceBase<ScopesContextValue['state']> implements ScopesContextValue {
  static #instance: ScopesService | undefined = undefined;

  private _selectorService: ScopesSelectorService = ScopesSelectorService.instance!;

  private constructor() {
    super({
      drawerOpened: false,
      enabled: false,
      loading: false,
      readOnly: false,
      value: [],
    });
  }

  public static get instance(): ScopesService | undefined {
    if (!ScopesService.#instance && config.featureToggles.scopeFilters) {
      ScopesService.#instance = new ScopesService();
    }

    return ScopesService.#instance;
  }

  public changeScopes = (scopeNames: string[]) => this._selectorService.changeScopes(scopeNames);

  public enableReadOnly = () => {
    if (!this.state.readOnly) {
      this.updateState({ readOnly: true });
    }

    if (this._selectorService.state.opened) {
      this._selectorService.closeAndReset();
    }
  };

  public disableReadOnly = () => {
    if (this.state.readOnly) {
      this.updateState({ readOnly: false });
    }
  };

  public enable = () => {
    if (!this.state.enabled) {
      this.updateState({ enabled: true });
    }
  };

  public disable = () => {
    if (this.state.enabled) {
      this.updateState({ enabled: false });
    }
  };

  public setScopes = (scopes: Scope[]) => this.updateState({ value: scopes });

  public setLoading = (loading: boolean) => {
    if (this.state.loading !== loading) {
      this.updateState({ loading });
    }
  };

  public setDrawerOpened = (drawerOpened: boolean) => {
    if (this.state.drawerOpened !== drawerOpened) {
      this.updateState({ drawerOpened });
    }
  };
}
