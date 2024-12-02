import { useObservable } from 'react-use';
import { Observable } from 'rxjs';

import { getScopesSelectorService } from './services';

export const useScopesSelectorService = () => {
  const scopesSelectorService = getScopesSelectorService();

  useObservable(scopesSelectorService?.stateObservable ?? new Observable(), scopesSelectorService?.state);

  if (!scopesSelectorService) {
    return undefined;
  }

  return scopesSelectorService;
};
