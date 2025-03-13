import { Scope } from '@grafana/data';
import { config, ScopesContextValue, ScopesContextValueState } from '@grafana/runtime';

import { ScopesServiceBase } from './ScopesServiceBase';
import { ScopesSelectorService } from './selector/ScopesSelectorService';

export class ScopesService extends ScopesServiceBase<ScopesContextValueState> implements ScopesContextValue {
  static #instance: ScopesService | undefined = undefined;

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

  public changeScopes = (scopeNames: string[]) => ScopesSelectorService.instance?.changeScopes(scopeNames);

  public setReadOnly = (readOnly: boolean) => {
    if (this.state.readOnly !== readOnly) {
      this.updateState({ readOnly });
    }

    if (readOnly && ScopesSelectorService.instance?.state.opened) {
      ScopesSelectorService.instance?.closeAndReset();
    }
  };

  public setEnabled = (enabled: boolean) => {
    if (this.state.enabled !== enabled) {
      this.updateState({ enabled });
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

  public reset = () => {
    ScopesService.#instance = undefined;
  };
}
