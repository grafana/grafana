import { createContext, useContext } from 'react';
import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { Scope } from '@grafana/data';

export interface ScopesContextValue {
  state: {
    isDrawerOpened: boolean;
    isEnabled: boolean;
    isLoading: boolean;
    isReadOnly: boolean;
    value: Scope[];
  };
  stateObservable: Observable<ScopesContextValue['state']>;
  changeScopes: (scopeNames: string[]) => void;
  enterReadOnly: () => void;
  exitReadOnly: () => void;
  toggleDrawer: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  enable: () => void;
  disable: () => void;
}

export const ScopesContext = createContext<ScopesContextValue | undefined>(undefined);

export function useScopes() {
  const context = useContext(ScopesContext);

  useObservable(context?.stateObservable ?? new Observable(), context?.state);

  return context
    ? {
        state: context.state,
        stateObservable: context.stateObservable,
        changeScopes: context.changeScopes,
        enterReadOnly: context.enterReadOnly,
        exitReadOnly: context.exitReadOnly,
        toggleDrawer: context.toggleDrawer,
        openDrawer: context.openDrawer,
        closeDrawer: context.closeDrawer,
        enable: context.enable,
        disable: context.disable,
      }
    : undefined;
}
