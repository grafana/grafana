import { useMemo } from 'react';

import { FlameChartContainer, RenderContainer, RenderItem } from '../types';
import { findMaxBounds } from '../utils/operation';

import { poopyVerticalLayout } from './verticalLayoutAlgos/poopyVerticalLayout';

const DEFAULT_HEIGHT_PX = 32;
const DEFAULT_VERTICAL_GAP_PX = 2;

interface UseRenderItemsOptions<T> {
  container: FlameChartContainer<T>;
  containerSize: { width: number; height: number };
  fromMs?: number;
  toMs?: number;
  heightPx?: number; // default 42
  verticalGapPx?: number; // default 2
  horizontalGapPx?: number; // default 2
}

const EMPTY_RENDER_CONTAINER: RenderContainer<any> = {
  fromMs: 0,
  toMs: 0,
  height: 0,
  items: [],
};

export function useRenderItems<T>(options: UseRenderItemsOptions<T>): RenderContainer<T> {
  const {
    fromMs: oFromMs,
    toMs: oToMs,
    verticalGapPx,
    heightPx,
    containerSize,
    container: { operations },
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

  const fromMs = Math.max(oFromMs ?? 0, minMs ?? 0);
  const toMs = Math.min(oToMs ?? Number.MAX_VALUE, maxMs);

  const viewDuration = toMs - fromMs;

  const pxPerMs = containerSize.width / viewDuration;

  const operationList = useMemo(() => poopyVerticalLayout(operations), [operations]);

  return useMemo(() => {
    console.log('renderItems', operationList);

    if (!(toMs > fromMs) || !containerSize.width || fromMs === 0) {
      return EMPTY_RENDER_CONTAINER;
    }

    let maxY = 0;

    const renderItems: Array<RenderItem<T>> = operationList.map((operation) => {
      const x = Math.floor((operation.operation.startMs - fromMs) * pxPerMs);
      const width = Math.max(Math.floor(operation.operation.durationMs * pxPerMs), 2);
      const y = Math.floor(
        operation.level * (heightPx ?? DEFAULT_HEIGHT_PX) + operation.level * (verticalGapPx ?? DEFAULT_VERTICAL_GAP_PX)
      );
      maxY = Math.max(maxY, y);
      return {
        operation: operation.operation,
        x,
        y,
        width,
      };
    });

    return {
      fromMs,
      toMs,
      height: maxY + (heightPx ?? DEFAULT_HEIGHT_PX),
      items: renderItems,
    };
  }, [fromMs, toMs, operationList, heightPx, verticalGapPx, pxPerMs, containerSize.width]);
}
