import { useMemo } from 'react';

import { FlameChartContainer, Operation, RenderContainer, RenderItem, TreeNode } from '../types';
import { reverseFind } from '../utils/array';
import { calcLevel, mapTree } from '../utils/tree';

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

interface OperationWithLevel<T> extends TreeNode<OperationWithLevel<T>> {
  level: number;
  operation: Operation<T>;
}

function toOpsWithLevel<T>(
  operations: Array<Operation<T>>,
  parent?: OperationWithLevel<T>
): Array<OperationWithLevel<T>> {
  return operations.map((operation) => {
    const op: OperationWithLevel<T> = {
      level: calcLevel(operation),
      operation,
      parent,
      children: [],
    };
    op.children = toOpsWithLevel(operation.children, op);
    return op;
  });
}

const EMPTY_RENDER_CONTAINER: RenderContainer<any> = {
  fromMs: 0,
  toMs: 0,
  height: 0,
  items: [],
};

function findMaxBounds<T>(operation: Operation<T>): [number, number] {
  let min = operation.startMs;
  let max = operation.startMs + operation.durationMs;
  operation.children.forEach((child) => {
    const [childMin, childMax] = findMaxBounds(child);
    min = Math.min(min, childMin);
    max = Math.max(max, childMax);
  });
  return [min, max];
}

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

  return useMemo(() => {
    console.log('renderItems', operations);
    const operationsWithLevel = toOpsWithLevel(operations);
    const operationList: Array<OperationWithLevel<T>> = mapTree(operationsWithLevel, (op) => op);

    if (!(toMs > fromMs) || !containerSize.width || fromMs === 0) {
      return EMPTY_RENDER_CONTAINER;
    }

    deconflict(operationList);

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
  }, [fromMs, toMs, operations, heightPx, verticalGapPx, pxPerMs, containerSize.width]);
}

function deconflict<T>(operations: Array<OperationWithLevel<T>>): void {
  console.log('deconflict', operations);

  const level2ops: Record<number, Array<OperationWithLevel<T>>> = {};

  let maxLevel = 0;

  operations.forEach((operation) => {
    if (!level2ops[operation.level]) {
      level2ops[operation.level] = [];
    }
    level2ops[operation.level].push(operation);
    maxLevel = Math.max(maxLevel, operation.level);
  });

  console.log('level2ops', { ...level2ops });

  function changeLevel(operation: OperationWithLevel<T>, level: number) {
    console.log('changeLevel', operation, level);
    level2ops[operation.level] = level2ops[operation.level].filter((op) => op !== operation);
    operation.level = level;
    if (!level2ops[level]) {
      level2ops[level] = [];
    }
    level2ops[level].push(operation);
    maxLevel = Math.max(maxLevel, level);
    operation.children.forEach((child) => {
      changeLevel(child, level + 1);
    });
  }

  function findIntersection(operation: OperationWithLevel<T>): OperationWithLevel<T> | undefined {
    if (!level2ops[operation.level]) {
      return undefined;
    }
    for (let i = level2ops[operation.level].length - 1; i >= 0; i--) {
      const op = level2ops[operation.level][i];
      if (
        op !== operation &&
        op.operation.startMs < operation.operation.startMs + operation.operation.durationMs &&
        op.operation.startMs + op.operation.durationMs > operation.operation.startMs
      ) {
        console.log('found intersection', operation, op);
        return op;
      }
    }
    return undefined;
  }

  function levelHasIntersections(fromMs: number, toMs: number, level: number) {
    if (!level2ops[level]) {
      return false;
    }
    for (let i = level2ops[level].length - 1; i >= 0; i--) {
      const op = level2ops[level][i];
      if (op.operation.startMs < toMs && op.operation.startMs + op.operation.durationMs > fromMs) {
        return true;
      }
    }
    return false;
  }

  function levelIsTopFree(fromMs: number, toMs: number, startLevel: number): boolean {
    for (let i = startLevel; i <= maxLevel; i++) {
      if (levelHasIntersections(fromMs, toMs, i)) {
        return false;
      }
    }
    return true;
  }

  function findTopFreeLevel(fromMs: number, toMs: number, startLevel: number): number {
    let level = startLevel;
    while (!levelIsTopFree(fromMs, toMs, level)) {
      level++;
    }
    return level;
  }

  function findLevelIntersection(level: number): OperationWithLevel<T> | undefined {
    return level2ops[level]?.find((op) => !!findIntersection(op));
  }

  let currentLevel = 0;

  while (currentLevel <= maxLevel) {
    console.log('engaging level ', currentLevel);
    while (true) {
      const intersectingOp = findLevelIntersection(currentLevel);
      if (!intersectingOp) {
        break;
      }
      console.log('intersect', intersectingOp);
      const [minMs, maxMs] = findMaxBounds(intersectingOp.operation);
      const newLevel = findTopFreeLevel(minMs, maxMs, currentLevel + 1) + 1;
      changeLevel(intersectingOp, newLevel);
    }
    currentLevel++;
  }
}
