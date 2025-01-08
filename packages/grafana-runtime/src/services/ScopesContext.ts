import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { Scope } from '@grafana/data';

export interface ScopesContextValueState {
  drawerOpened: boolean;
  enabled: boolean;
  loading: boolean;
  readOnly: boolean;
  value: Scope[];
}

export interface ScopesContextValue {
  /**
   * Current state.
   */
  state: ScopesContextValueState;

  /**
   * Observable that emits the current state.
   */
  stateObservable: Observable<ScopesContextValue['state']>;

  /**
   * Change the selected scopes. The service takes care about loading them and propagating the changes.
   * @param scopeNames
   */
  changeScopes(scopeNames: string[]): void;

  /**
   * Set read-only mode.
   * If `readOnly` is `true`, the selector will be set to read-only and the dashboards panel will be closed.
   */
  setReadOnly(readOnly: boolean): void;

  /**
   * Enable or disable the usage of scopes.
   * This will hide the selector and the dashboards panel, and it will stop propagating the scopes to the query object.
   */
  setEnabled(enabled: boolean): void;
}

export const ScopesContext = createContext<ScopesContextValue | undefined>(undefined);

export function useScopes(): ScopesContextValue | undefined {
  const context = useContext(ScopesContext);

  useObservable(context?.stateObservable ?? new Observable(), context?.state);

  return context
    ? {
        state: context.state,
        stateObservable: context.stateObservable,
        changeScopes: context.changeScopes,
        setReadOnly: context.setReadOnly,
        setEnabled: context.setEnabled,
      }
    : undefined;
}
