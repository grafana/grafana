import { useCallback, useMemo } from 'react';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';

import { prepareColumnContext } from './columnContext';
import { tableTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

export function useColumnTransformations(
  sourceIndex: number | undefined,
  api: PanelRuntimeTransformations | undefined,
  owner: string
) {
  const { transformations, sourceSeries, update } = useTableTransformations(api, owner);
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

  return useMemo(
    () =>
      context
        ? {
            ...tableTransformations.columnVisibility.read(transformations, context),
            columnCatalog: context.catalog,
            onHiddenColumnsChange,
          }
        : undefined,
    [context, transformations, onHiddenColumnsChange]
  );
}
