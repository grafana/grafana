import { createContext, useContext, useMemo } from 'react';
import { useObservable } from 'react-use';

import { ScopesSelectorService, ScopesSelectorServiceState } from './ScopesSelectorService';
import { getScopesSelectorService } from './scopes';

export const ScopesSelectorContext = createContext<ScopesSelectorService>(getScopesSelectorService());

export function useScopesSelector() {
  const context = useContext(ScopesSelectorContext);
  const state: ScopesSelectorServiceState | undefined = useObservable(context.stateObservable, context.state);
  return useMemo(() => {
    return {
      state,
      open: context.openPicker.bind(context),
      close: context.closePicker.bind(context),
      removeAllScopes: context.removeAllScopes.bind(context),
      resetDirtyScopeNames: context.resetDirtyScopeNames.bind(context),
      toggleNodeSelect: context.toggleNodeSelect.bind(context),
      updateNode: context.updateNode.bind(context),
      updateScopes: context.updateScopes.bind(context),
    };
  }, [context, state]);
}
