import { createContext, useContext, useMemo } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { Scope } from '@grafana/data';

export interface ScopesContextValueState {
  // Whether the drawer with the related dashboards is open
  drawerOpened: boolean;
  enabled: boolean;

  // loading state of the scopes
  loading: boolean;
  readOnly: boolean;

  // Currently selected scopes
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

  return useMemo(() => {
    return context
      ? {
          state: context.state,
          stateObservable: context.stateObservable,
          changeScopes: context.changeScopes,
          setReadOnly: context.setReadOnly,
          setEnabled: context.setEnabled,
        }
      : undefined;
    // Not sure why it thinks the context?.state is not required, but we want to recreate this when the state changes.
    // context.stateObservable is readOnly so that is not needed, others are methods which should not change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, context?.state]);
}
