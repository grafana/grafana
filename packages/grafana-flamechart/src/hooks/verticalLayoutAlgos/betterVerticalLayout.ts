import { OperationWithLevel, Operation } from '../../types';
import { findMaxBoundsLeft } from '../../utils/operation';

export function betterVerticalLayout<T>(operations: Array<Operation<T>>): Array<OperationWithLevel<T>> {
  console.log('layout', operations);
  const level2ops: Record<number, Array<OperationWithLevel<T>>> = {};

  const operationsWithLevel: Array<OperationWithLevel<T>> = [];
  let maxLevel = 0;

  function hasIntersections(fromMs: number, toMs: number, level: number): boolean {
    const ops = level2ops[level];
    if (!ops) {
      return false;
    }

    return ops.some(
      (otherOp) => fromMs < otherOp.operation.startMs + otherOp.operation.durationMs && toMs > otherOp.operation.startMs
    );
  }

  function levelIsTopFree(fromMs: number, toMs: number, startLevel: number): boolean {
    for (let i = startLevel; i <= maxLevel; i++) {
      if (hasIntersections(fromMs, toMs, i)) {
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

  function assignLevel(op: Operation<T>, parent?: OperationWithLevel<T>): OperationWithLevel<T> {
    let level = parent ? parent.level + 1 : 0;

    // if this is nth-child of the parent, check that we're free to place it and it's first-child-based-subtree
    if (
      level === 0 ||
      (parent?.operation.children && parent.operation.children.length > 1 && parent.operation.children[0] !== op)
    ) {
      const [fromMs, toMs] = findMaxBoundsLeft(op);
      if (!levelIsTopFree(fromMs, toMs, level)) {
        level = findTopFreeLevel(Math.min(fromMs, parent?.operation.startMs ?? 0), toMs, level + 1) + 1;
      } else {
      }
    }

    const operationWithLevel: OperationWithLevel<T> = {
      level,
      operation: op,
      children: [],
      parent,
    };

    maxLevel = Math.max(maxLevel, level);

    if (!level2ops[level]) {
      level2ops[level] = [];
    }
    level2ops[level].push(operationWithLevel);

    if (parent) {
      parent.children.push(operationWithLevel);
    }

    operationsWithLevel.push(operationWithLevel);

    op.children.forEach((child) => {
      assignLevel(child, operationWithLevel);
    });

    return operationWithLevel;
  }

  return operations.map((op) => assignLevel(op));
}
