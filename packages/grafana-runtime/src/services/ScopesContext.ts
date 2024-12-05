import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';
import { Observable, Subscription } from 'rxjs';

import { Scope } from '@grafana/data';

export interface ScopesContextValue {
  state: {
    isEnabled: boolean;
    isLoading: boolean;
    isReadOnly: boolean;
    pendingScopes: string[] | null;
    value: Scope[];
  };
  stateObservable: Observable<ScopesContextValue['state']>;
  setNewScopes: (scopeNames: string[] | null) => void;
  setCurrentScopes: (scopes: Scope[]) => void;
  enterLoadingMode: () => void;
  exitLoadingMode: () => void;
  enterReadOnly: () => void;
  exitReadOnly: () => void;
  enable: () => void;
  disable: () => void;
  subscribeToState: (
    cb: (newState: ScopesContextValue['state'], prevState: ScopesContextValue['state']) => void
  ) => Subscription;
}

export const ScopesContext = createContext<ScopesContextValue | undefined>(undefined);

export function useScopes() {
  const context = useContext(ScopesContext);

  useObservable(context?.stateObservable ?? new Observable(), context?.state);

  if (!context) {
    return undefined;
  }

  return context;
}
