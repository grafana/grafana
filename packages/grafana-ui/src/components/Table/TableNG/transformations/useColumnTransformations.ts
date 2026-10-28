import { useCallback, useEffect, useMemo, useRef } from 'react';

import { type DataFrame } from '@grafana/data';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';
import { type TableNGProps } from '../types';

import { prepareColumnContext } from './columnContext';
import { ensureVisibleColumnPerFrame } from './columnVisibility';
import { columnTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

function shouldResetColumnOrder(previous: string[], current: string[]): boolean {
  // Ignore additions and removals; only a changed relative order of shared columns invalidates saved indices.
  const previousNames = new Set(previous);
  const currentNames = new Set(current);
  const sharedBefore = previous.filter((name) => currentNames.has(name));
  const sharedAfter = current.filter((name) => previousNames.has(name));

  if (sharedBefore.length === 0) {
    // With no overlap, any non-empty catalog means the saved order belongs to a different schema.
    return previous.length !== 0 || current.length !== 0;
  }

  return sharedBefore.some((name, index) => name !== sharedAfter[index]);
}

export function useColumnTransformations(
  sourceIndex: number,
  api: PanelRuntimeTransformations | undefined,
  owner: string,
  enabled = sourceIndex >= 0,
  sourceSeries: readonly DataFrame[] | undefined = api?.getSourceSeries(owner)
) {
  const { transformations, update } = useTableTransformations(api, owner);
  useEffect(() => {
    if (enabled && sourceSeries && transformations.length > 0) {
      update((current) => ensureVisibleColumnPerFrame(current, sourceSeries));
    }
  }, [enabled, sourceSeries, transformations, update]);
  const sourceFrame = enabled && sourceIndex >= 0 ? sourceSeries?.[sourceIndex] : undefined;
  const context = useMemo(
    () =>
      sourceFrame && sourceSeries && sourceIndex >= 0 ? prepareColumnContext(sourceSeries, sourceIndex) : undefined,
    [sourceFrame, sourceSeries, sourceIndex]
  );
  // Keep the last non-empty source catalog per frame as the comparison baseline.
  // The baseline belongs to one panel, so it is cleared when the table stays mounted
  // while the dashboard swaps the panel underneath it (for example undoing an edit).
  const previousCatalogs = useRef(new Map<string, string[]>());
  const catalogsApi = useRef(api);
  useEffect(() => {
    if (catalogsApi.current !== api) {
      catalogsApi.current = api;
      previousCatalogs.current.clear();
    }

    if (!context || context.catalog.length === 0) {
      return;
    }

    const frameKey = sourceFrame?.refId ?? `#${sourceIndex}`;
    const previous = previousCatalogs.current.get(frameKey);
    previousCatalogs.current.set(frameKey, context.catalog);
    if (previous && shouldResetColumnOrder(previous, context.catalog)) {
      update((current) =>
        columnTransformations.columnOrder.read(current, context).columnOrder
          ? columnTransformations.columnOrder.write(current, [], context)
          : current
      );
    }
  }, [api, context, sourceFrame?.refId, sourceIndex, update]);
  const onHiddenColumnsChange = useCallback(
    (hidden: ReadonlySet<string>) => {
      if (context) {
        update((current) => columnTransformations.columnVisibility.write(current, hidden, context));
      }
    },
    [context, update]
  );
  const onColumnOrderChange = useCallback(
    (order: string[]) => {
      if (context) {
        update((current) => columnTransformations.columnOrder.write(current, order, context));
      }
    },
    [context, update]
  );

  return useMemo(() => {
    if (!context) {
      return undefined;
    }

    const columnProps = Object.values(columnTransformations).reduce<
      Pick<TableNGProps, 'hiddenColumns' | 'columnOrder'>
    >((columnProps, transformation) => ({ ...columnProps, ...transformation.read(transformations, context) }), {});

    return {
      ...columnProps,
      columnCatalog: columnProps.columnOrder ?? context.catalog,
      onColumnOrderChange,
      onHiddenColumnsChange,
    };
  }, [context, transformations, onHiddenColumnsChange, onColumnOrderChange]);
}
