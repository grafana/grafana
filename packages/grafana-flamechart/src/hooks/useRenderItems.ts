import { useMemo } from 'react';

import { FlameChartContainer, Operation, RenderContainer, RenderItem } from '../types';

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

type OperationWithLevel<T> = Operation<T> & {
  level: number;
};

const EMPTY_RENDER_CONTAINER: RenderContainer<any> = {
  fromMs: 0,
  toMs: 0,
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

  const [minMs, maxMs] = useMemo(() => {
    return [
      Math.min(...mapOperations(operations, (operation) => operation.startMs)),
      Math.max(...mapOperations(operations, (operation) => operation.startMs + operation.durationMs)),
    ];
  }, [operations]);

  const fromMs = Math.max(oFromMs ?? 0, minMs ?? 0);
  const toMs = Math.min(oToMs ?? Number.MAX_VALUE, maxMs);

  const viewDuration = toMs - fromMs;

  const pxPerMs = containerSize.width / viewDuration;

  return useMemo(() => {
    const ops: Array<OperationWithLevel<T>> = mapOperations(
      operations,
      (operation): OperationWithLevel<T> => ({
        ...operation,
        level: calcLevel(operation),
      })
    );

    if (!(toMs > fromMs) || !containerSize.width || !containerSize.height) {
      return EMPTY_RENDER_CONTAINER;
    }
    const renderItems: Array<RenderItem<T>> = ops.map((operation) => {
      const x = Math.floor((operation.startMs - fromMs) * pxPerMs);
      const width = Math.max(Math.floor(operation.durationMs * pxPerMs), 2);
      const y = Math.floor(
        operation.level * (heightPx ?? DEFAULT_HEIGHT_PX) + operation.level * (verticalGapPx ?? DEFAULT_VERTICAL_GAP_PX)
      );
      return {
        operation,
        x,
        y,
        width,
      };
    });

    // @TODO deconflict

    return {
      fromMs,
      toMs,
      items: renderItems,
    };
  }, [fromMs, toMs, operations, heightPx, verticalGapPx, pxPerMs, containerSize]);
}

function calcLevel<T>(operation: Operation<T>) {
  let level = 0;
  let parent = operation.parent;
  while (parent) {
    level++;
    parent = parent.parent;
  }
  return level;
}

function iterOperations<T>(operations: Array<Operation<T>>, fn: (operation: Operation<T>) => void): void {
  operations.forEach((operation) => {
    fn(operation);
    iterOperations(operation.children, fn);
  });
}

function mapOperations<T, R>(operations: Array<Operation<T>>, fn: (operation: Operation<T>) => R): R[] {
  const acc: R[] = [];
  iterOperations(operations, (operation) => {
    acc.push(fn(operation));
  });
  return acc;
}
