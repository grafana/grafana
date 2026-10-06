import { useCallback, useMemo } from 'react';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';
import { type TableNGProps } from '../types';

import { prepareColumnContext } from './columnContext';
import { columnTransformations } from './registry';
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
        update((current) => columnTransformations.columnVisibility.write(current, hidden, context));
      }
    },
    [context, update]
  );

  return useMemo(() => {
    if (!context) {
      return undefined;
    }

    const state = Object.values(columnTransformations).reduce<Pick<TableNGProps, 'hiddenColumns'>>(
      (state, transformation) => ({ ...state, ...transformation.read(transformations, context) }),
      {}
    );

    return {
      ...state,
      columnCatalog: context.catalog,
      onHiddenColumnsChange,
    };
  }, [context, transformations, onHiddenColumnsChange]);
}
