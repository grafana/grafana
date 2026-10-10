import { useCallback, useMemo, useSyncExternalStore } from 'react';

import { type DataTransformerConfig } from '@grafana/data';

import { type AdHocTransformationsState, usePanelContext } from './PanelContext';

/**
 * Returns the selected owner's transformations and re-renders when the panel host changes them.
 * Returns `undefined` when the panel host does not support ad-hoc transformations.
 *
 * @alpha
 */
export function useAdHocTransformations(owner: string): AdHocTransformationsState | undefined {
  const api = usePanelContext().adHocTransformations;
  const subscribe = useCallback(
    (onChange: () => void) => (api ? api.subscribe(owner, onChange) : () => {}),
    [api, owner]
  );
  const getSnapshot = useCallback(() => api?.get(owner), [api, owner]);
  const transformations = useSyncExternalStore(subscribe, getSnapshot);
  const sourceSeries = api?.getSourceSeries(owner);
  const setTransformations = useCallback(
    (nextTransformations: readonly DataTransformerConfig[]) => api?.set(owner, nextTransformations),
    [api, owner]
  );

  return useMemo(
    () => (transformations && sourceSeries ? { transformations, sourceSeries, setTransformations } : undefined),
    [transformations, sourceSeries, setTransformations]
  );
}
