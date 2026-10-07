import { useCallback, useEffect, useMemo } from 'react';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';
import { type TableNGProps } from '../types';

import { prepareColumnContext } from './columnContext';
import { ensureVisibleColumnPerFrame } from './columnVisibility';
import { columnTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

export function useColumnTransformations(
  sourceIndex: number | undefined,
  api: PanelRuntimeTransformations | undefined,
  owner: string,
  enabled = sourceIndex !== undefined
) {
  const { transformations, sourceSeries, update } = useTableTransformations(api, owner);
  useEffect(() => {
    if (enabled && sourceSeries && transformations.length > 0) {
      update((current) => ensureVisibleColumnPerFrame(current, sourceSeries));
    }
  }, [enabled, sourceSeries, transformations, update]);
  const sourceFrame = enabled && sourceIndex !== undefined ? sourceSeries?.[sourceIndex] : undefined;
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

    const columnProps = Object.values(columnTransformations).reduce<Pick<TableNGProps, 'hiddenColumns'>>(
      (columnProps, transformation) => ({ ...columnProps, ...transformation.read(transformations, context) }),
      {}
    );

    return {
      ...columnProps,
      columnCatalog: context.catalog,
      onHiddenColumnsChange,
    };
  }, [context, transformations, onHiddenColumnsChange]);
}
