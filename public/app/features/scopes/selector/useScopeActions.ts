import { useMemo } from 'react';

import { useScopesServices } from '../ScopesContextProvider';

import { type SelectedScope } from './types';

export interface ChangeScopesOptions {
  /** The node of the first scope, so the selector can expand to it later. */
  scopeNodeId?: string;
  /** Whether applying may redirect to the node's `redirectPath`. Selecting in the drawer redirects, so this defaults to true. */
  redirect?: boolean;
}

/**
 * Hook that provides stable references to scope action methods.
 * These methods never change, so they won't cause re-renders when passed as props.
 *
 * This eliminates the need to drill these action methods through multiple component layers.
 *
 * When the selector service is missing, or only partly provided as in some tests, every action is a harmless no-op.
 * `isAvailable` tells a consumer whether there is a service at all, so it never has to look the service up itself.
 */
export function useScopeActions() {
  const services = useScopesServices();
  const selector = services?.scopesSelectorService;

  return useMemo(
    () => ({
      isAvailable: Boolean(selector),
      selectScope: selector?.selectScope ?? (() => {}),
      deselectScope: selector?.deselectScope ?? (() => {}),
      filterNode: selector?.filterNode ?? (() => {}),
      toggleExpandedNode: selector?.toggleExpandedNode ?? (() => {}),
      // The service takes positional arguments and its second one is never used, so this wraps it with options.
      changeScopes: (scopeIds: string[], options?: ChangeScopesOptions): Promise<void> =>
        selector?.changeScopes?.(scopeIds, undefined, options?.scopeNodeId, options?.redirect ?? true) ??
        Promise.resolve(),
      apply: selector?.apply ?? (() => Promise.resolve()),
      closeAndApply: selector?.closeAndApply ?? (() => Promise.resolve()),
      closeAndReset: selector?.closeAndReset ?? (() => {}),
      resetSelection: selector?.resetSelection ?? (() => {}),
      removeAllScopes: selector?.removeAllScopes ?? (() => {}),
      open: selector?.open ?? (() => Promise.resolve()),
      searchAllNodes: selector?.searchAllNodes ?? (() => Promise.resolve([])),
      getScopeNode: selector?.getScopeNode ?? (() => Promise.resolve(undefined)),
      getScopeNodes: selector?.getScopeNodes ?? (() => Promise.resolve([])),
      // setRedirectEnabled is a prototype method, so it is called through the service at call time to keep `this`
      // and to let a spy installed after mount still see the call.
      setRedirectEnabled: (enabled: boolean) => selector?.setRedirectEnabled(enabled),
      // Reads the applied scopes when called, for event handlers that need the value right now. A value captured
      // while rendering could be stale by the time the handler runs.
      getAppliedScopes: (): SelectedScope[] => selector?.state?.appliedScopes ?? [],
    }),
    [selector]
  );
}
