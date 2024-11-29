import { useObservable } from 'react-use';

import { scopesSelectorService } from './ScopesSelectorService';

export const useScopesSelectorService = () => {
  const state = useObservable(scopesSelectorService.stateObservable, scopesSelectorService.state);

  return {
    state,
    updateNode: scopesSelectorService.updateNode.bind(scopesSelectorService),
    toggleNodeSelect: scopesSelectorService.toggleNodeSelect.bind(scopesSelectorService),
    applyNewScopes: scopesSelectorService.applyNewScopes.bind(scopesSelectorService),
    dismissNewScopes: scopesSelectorService.dismissNewScopes.bind(scopesSelectorService),
    removeAllScopes: scopesSelectorService.removeAllScopes.bind(scopesSelectorService),
    open: scopesSelectorService.open.bind(scopesSelectorService),
    close: scopesSelectorService.close.bind(scopesSelectorService),
  };
};
