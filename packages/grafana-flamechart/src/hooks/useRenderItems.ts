import { useEffect, useMemo, useState } from 'react';

import { FlameChartContainer, ParallelConnector, RenderContainer, RenderItem, ViewRange } from '../types';
import { findMaxBounds } from '../utils/operation';
import { mapTree } from '../utils/tree';

import { betterVerticalLayout } from './verticalLayoutAlgos/betterVerticalLayout';

const DEFAULT_HEIGHT_PX = 32;
const DEFAULT_VERTICAL_GAP_PX = 2;

interface UseRenderItemsOptions<T> {
  container: FlameChartContainer<T>;
  containerSize: { width: number; height: number };
  viewRange: ViewRange;
  heightPx?: number; // default 42
  verticalGapPx?: number; // default 2
  horizontalGapPx?: number; // default 2
}

const EMPTY_RENDER_CONTAINER: RenderContainer<any> = {
  fromMs: 0,
  toMs: 0,
  height: 0,
  items: [],
  connectors: [],
};

function calcFomTo(minMs: number, maxMs: number, viewRange: ViewRange): { fromMs: number; toMs: number } {
  const duration = maxMs - minMs;
  return { fromMs: minMs + duration * viewRange.time.current[0], toMs: minMs + duration * viewRange.time.current[1] };
}

export function useRenderItems<T>(options: UseRenderItemsOptions<T>): RenderContainer<T> {
  const {
    viewRange,
    verticalGapPx,
    heightPx,
    containerSize,
    container: { operations, getOperationId },
  } = options;

  const [minMs, maxMs] = useMemo(
    () =>
      operations.reduce(
        ([min, max], operation) => {
          const [childMin, childMax] = findMaxBounds(operation);
          return [Math.min(min, childMin), Math.max(max, childMax)];
        },
        [Number.MAX_VALUE, 0]
      ),
    [operations]
  );

  const [{ fromMs, toMs }, setTimeRange] = useState(calcFomTo(minMs, maxMs, viewRange));

  useEffect(() => {
    if (!viewRange.time.cursor) {
      setTimeRange(calcFomTo(minMs, maxMs, viewRange));
    }
  }, [minMs, maxMs, viewRange]);

  const viewDuration = toMs - fromMs;

  const pxPerMs = containerSize.width / viewDuration;

  const operationsWithLevel = useMemo(() => betterVerticalLayout(operations), [operations]);

  return useMemo(() => {
    console.log('renderItems', operationsWithLevel);

    if (!(toMs > fromMs) || !containerSize.width || fromMs === 0) {
      return EMPTY_RENDER_CONTAINER;
    }

    let maxY = 0;

    const opIdToRenderItem: Record<string, RenderItem<T>> = {};

    const connectors: Array<ParallelConnector<T>> = [];

    const renderItems: Array<RenderItem<T>> = mapTree(operationsWithLevel, (operation) => {
      const x = Math.max(Math.floor((operation.operation.startMs - fromMs) * pxPerMs), 0);
      const width = Math.min(
        Math.max(Math.floor(operation.operation.durationMs * pxPerMs), 2),
        containerSize.width - x
      );
      const y = Math.floor(
        operation.level * (heightPx ?? DEFAULT_HEIGHT_PX) + operation.level * (verticalGapPx ?? DEFAULT_VERTICAL_GAP_PX)
      );
      maxY = Math.max(maxY, y);
      const renderItem: RenderItem<T> = {
        operation: operation.operation,
        x,
        y,
        width,
        visible: width > 0 && x < containerSize.width,
        cutOffLeft: operation.operation.startMs < fromMs,
        cutOffRight: operation.operation.startMs + operation.operation.durationMs > toMs,
      };
      opIdToRenderItem[getOperationId(operation.operation.entity)] = renderItem;

      if (operation.parent && operation.level - operation.parent.level > 1) {
        const renderParent = opIdToRenderItem[getOperationId(operation.parent.operation.entity)];
        if (renderParent) {
          connectors.push({
            parent: renderParent,
            child: renderItem,
          });
        }
      }

      return renderItem;
    });

    return {
      fromMs,
      toMs,
      height: maxY + (heightPx ?? DEFAULT_HEIGHT_PX),
      items: renderItems,
      connectors,
    };
  }, [fromMs, toMs, operationsWithLevel, heightPx, verticalGapPx, getOperationId, pxPerMs, containerSize.width]);
}
