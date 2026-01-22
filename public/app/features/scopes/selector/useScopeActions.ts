import { useMemo } from 'react';

import { useScopesServices } from '../ScopesContextProvider';

/**
 * Hook that provides stable references to scope action methods.
 * These methods never change, so they won't cause re-renders when passed as props.
 *
 * This eliminates the need to drill these action methods through multiple component layers.
 */
export function useScopeActions() {
  const services = useScopesServices();
  const selector = services?.scopesSelectorService;

  return useMemo(
    () => ({
      selectScope: selector?.selectScope ?? (() => {}),
      deselectScope: selector?.deselectScope ?? (() => {}),
      filterNode: selector?.filterNode ?? (() => {}),
      toggleExpandedNode: selector?.toggleExpandedNode ?? (() => {}),
    }),
    [selector]
  );
}
