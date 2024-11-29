import { useObservable } from 'react-use';

import { getScopesSelectorService } from './services';

const noop = () => undefined;

export const useScopesSelectorService = () => {
  const scopesSelectorService = getScopesSelectorService();

  if (!scopesSelectorService) {
    return {
      state: {
        isOpened: false,
        loadingNodeName: undefined,
        nodes: {},
        selectedScopes: [],
        treeScopes: [],
      },
      updateNode: noop,
      toggleNodeSelect: noop,
      applyNewScopes: noop,
      dismissNewScopes: noop,
      removeAllScopes: noop,
      openPicker: noop,
      closePicker: noop,
    };
  }

  const state = useObservable(scopesSelectorService.stateObservable, scopesSelectorService.state);

  return {
    state,
    updateNode: scopesSelectorService.updateNode.bind(scopesSelectorService),
    toggleNodeSelect: scopesSelectorService.toggleNodeSelect.bind(scopesSelectorService),
    applyNewScopes: scopesSelectorService.applyNewScopes.bind(scopesSelectorService),
    dismissNewScopes: scopesSelectorService.dismissNewScopes.bind(scopesSelectorService),
    removeAllScopes: scopesSelectorService.removeAllScopes.bind(scopesSelectorService),
    openPicker: scopesSelectorService.openPicker.bind(scopesSelectorService),
    closePicker: scopesSelectorService.closePicker.bind(scopesSelectorService),
  };
};
