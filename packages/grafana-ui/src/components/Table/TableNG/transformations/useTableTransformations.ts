import { useCallback, useState, useSyncExternalStore } from 'react';

import { type DataTransformerConfig } from '@grafana/data';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';

const EMPTY_TRANSFORMATIONS: readonly DataTransformerConfig[] = [];

export type UpdateTransformations = (
  change: (current: readonly DataTransformerConfig[]) => readonly DataTransformerConfig[]
) => void;

export function useTableTransformations(
  api: PanelRuntimeTransformations | undefined,
  owner: string,
  localFallback = false
) {
  const transformations = useSyncExternalStore(
    useCallback((listener) => api?.subscribe(owner, listener) ?? (() => {}), [api, owner]),
    useCallback(() => api?.get(owner) ?? EMPTY_TRANSFORMATIONS, [api, owner])
  );
  const [local, setLocal] = useState<readonly DataTransformerConfig[]>(EMPTY_TRANSFORMATIONS);
  const update: UpdateTransformations = useCallback(
    (change) => {
      if (!api && localFallback) {
        setLocal(change);
      } else if (api) {
        // Read at write time so successive actions cannot overwrite one another.
        const current = api.get(owner);
        const next = change(current);
        if (next !== current) {
          api.set(owner, next);
        }
      }
    },
    [api, owner, localFallback]
  );

  return { transformations: api ? transformations : local, sourceSeries: api?.getSourceSeries(owner), update };
}
