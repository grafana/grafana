import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { getScopesSelectorService } from './services';

export const useScopesSelectorService = () => {
  const scopesSelectorService = getScopesSelectorService();

  useObservable(scopesSelectorService?.stateObservable ?? new Observable(), scopesSelectorService?.state);

  return scopesSelectorService
    ? {
        state: scopesSelectorService.state,
        updateNode: scopesSelectorService.updateNode,
        toggleNodeSelect: scopesSelectorService.toggleNodeSelect,
        applyNewScopes: scopesSelectorService.applyNewScopes,
        dismissNewScopes: scopesSelectorService.dismissNewScopes,
        removeAllScopes: scopesSelectorService.removeAllScopes,
        openPicker: scopesSelectorService.openPicker,
        closePicker: scopesSelectorService.closePicker,
      }
    : undefined;
};
