import { isEqual } from 'lodash';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import { type DataFrame } from '@grafana/data';
import { createFieldReferenceIndex, type FieldReference } from '@grafana/data/internal';

import { type PanelRuntimeTransformations } from '../../../PanelChrome/PanelContext';
import { type TableNGProps } from '../types';

import { prepareColumnContext } from './columnContext';
import { ensureVisibleColumnPerFrame } from './columnVisibility';
import { columnTransformations } from './registry';
import { useTableTransformations } from './useTableTransformations';

function shouldResetColumnOrder(previous: readonly FieldReference[], current: readonly FieldReference[]): boolean {
  // Ignore additions and removals; only a changed relative order of shared columns invalidates saved indices.
  const find = createFieldReferenceIndex(current);
  const shared = previous.map((reference) => find(reference)).filter((index) => index >= 0);

  if (shared.length === 0) {
    // With no overlap, any non-empty catalog means the saved order belongs to a different schema.
    return previous.length !== 0 || current.length !== 0;
  }

  return shared.some((index, position) => position > 0 && index < shared[position - 1]);
}

export function useColumnTransformations(
  sourceIndex: number,
  api: PanelRuntimeTransformations | undefined,
  owner: string,
  enabled = sourceIndex >= 0,
  sourceSeries: readonly DataFrame[] | undefined = api?.getSourceSeries(owner),
  onInteraction?: (action: 'visibility' | 'reorder') => void,
  displaySeries?: readonly DataFrame[]
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
      sourceFrame && sourceSeries && sourceIndex >= 0
        ? prepareColumnContext(sourceSeries, sourceIndex, displaySeries)
        : undefined,
    [sourceFrame, sourceSeries, sourceIndex, displaySeries]
  );
  // Keep the last non-empty source catalog per frame as the comparison baseline.
  // The baseline belongs to one panel, so it is cleared when the table stays mounted
  // while the dashboard swaps the panel underneath it (for example undoing an edit).
  const previousCatalogs = useRef(new Map<string, readonly FieldReference[]>());
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
    previousCatalogs.current.set(frameKey, context.references);
    if (previous && shouldResetColumnOrder(previous, context.references)) {
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
        update(
          (current) => {
            const next = columnTransformations.columnVisibility.write(current, hidden, context);
            return isEqual(current, next) ? current : next;
          },
          () => onInteraction?.('visibility')
        );
      }
    },
    [context, update, onInteraction]
  );
  const onColumnOrderChange = useCallback(
    (order: string[]) => {
      if (context) {
        const displayCatalog = context.displayNames ?? context.catalog;
        let orderChanged = false;
        update(
          (current) => {
            const before = columnTransformations.columnOrder.read(current, context).columnOrder ?? displayCatalog;
            const next = columnTransformations.columnOrder.write(current, order, context);
            const after = columnTransformations.columnOrder.read(next, context).columnOrder ?? displayCatalog;
            orderChanged = !isEqual(before, after);
            return orderChanged ? next : current;
          },
          () => {
            if (orderChanged) {
              onInteraction?.('reorder');
            }
          }
        );
      }
    },
    [context, update, onInteraction]
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
      columnCatalog: columnProps.columnOrder ?? context.displayNames ?? context.catalog,
      onColumnOrderChange,
      onHiddenColumnsChange,
    };
  }, [context, transformations, onHiddenColumnsChange, onColumnOrderChange]);
}
