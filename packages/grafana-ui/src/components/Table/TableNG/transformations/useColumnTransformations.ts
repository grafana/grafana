import { useCallback, useMemo } from 'react';

import { type DataFrame } from '@grafana/data';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';

import { prepareColumnContext, resolveColumnSourceIndex } from './columnContext';
import { tableTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

export function useColumnTransformations(
  frames: readonly DataFrame[],
  frameIndex: number,
  enabled: boolean,
  api: PanelRuntimeTransformations | undefined,
  owner: string
) {
  const { transformations, sourceSeries, update } = useTableTransformations(api, owner);
  const sourceIndex = enabled ? resolveColumnSourceIndex(frames, frameIndex, sourceSeries) : undefined;
  const sourceFrame = sourceIndex !== undefined ? sourceSeries?.[sourceIndex] : undefined;
  const context = useMemo(
    () =>
      sourceFrame && sourceSeries && sourceIndex !== undefined
        ? prepareColumnContext(sourceSeries, sourceIndex)
        : undefined,
    [sourceFrame, sourceSeries, sourceIndex]
  );
  const onHiddenColumnsChange = useCallback(
    (hidden: ReadonlySet<string>) => {
      if (context) {
        update((current) => tableTransformations.columnVisibility.write(current, hidden, context));
      }
    },
    [context, update]
  );
  const onColumnOrderChange = useCallback(
    (order: string[]) => {
      if (context) {
        update((current) => tableTransformations.columnOrder.write(current, order, context));
      }
    },
    [context, update]
  );
  const columnOrder = useMemo(
    () => (context ? tableTransformations.columnOrder.read(transformations, context) : undefined),
    [context, transformations]
  );

  return useMemo(
    () =>
      context
        ? {
            ...tableTransformations.columnVisibility.read(transformations, context),
            columnOrder,
            columnCatalog: columnOrder ?? context.catalog,
            onColumnOrderChange,
            onHiddenColumnsChange,
          }
        : undefined,
    [context, transformations, onHiddenColumnsChange, columnOrder, onColumnOrderChange]
  );
}
