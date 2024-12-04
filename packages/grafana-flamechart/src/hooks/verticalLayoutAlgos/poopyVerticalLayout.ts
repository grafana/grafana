import { Operation, OperationWithLevel } from '../../types';
import { findMaxBounds } from '../../utils/operation';
import { calcLevel, mapTree } from '../../utils/tree';

/*
First approach.
Assigns levels first, then pushes things around.
This was bad idea. Should walk the tree and assign levels while deconflicting.
*/
export function poopyVerticalLayout<T>(operations: Array<Operation<T>>): Array<OperationWithLevel<T>> {
  console.log('poopyVerticalLayout', operations);

  const operationsWithLevel = toOpsWithLevel(operations);

  const operationList: Array<OperationWithLevel<T>> = mapTree(operationsWithLevel, (op) => op);

  const level2ops: Record<number, Array<OperationWithLevel<T>>> = {};

  let maxLevel = 0;

  operationList.forEach((operation) => {
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

  function isAncestorOf(ancestor: OperationWithLevel<T>, descendant: OperationWithLevel<T>): boolean {
    let parent: OperationWithLevel<T> | undefined = descendant;
    while (parent) {
      if (parent === ancestor) {
        return true;
      }
      parent = parent.parent;
    }
    return false;
  }

  function levelHasIntersections(fromMs: number, toMs: number, level: number, disregardParent?: OperationWithLevel<T>) {
    if (!level2ops[level]) {
      return false;
    }
    for (let i = level2ops[level].length - 1; i >= 0; i--) {
      const op = level2ops[level][i];
      if (disregardParent && isAncestorOf(disregardParent, op)) {
        continue;
      }
      if (op.operation.startMs < toMs && op.operation.startMs + op.operation.durationMs > fromMs) {
        return true;
      }
    }
    return false;
  }

  function levelIsTopFree(
    fromMs: number,
    toMs: number,
    startLevel: number,
    disregardParent?: OperationWithLevel<T>
  ): boolean {
    for (let i = startLevel; i <= maxLevel; i++) {
      if (levelHasIntersections(fromMs, toMs, i, disregardParent)) {
        return false;
      }
    }
    return true;
  }

  function findTopFreeLevel(fromMs: number, toMs: number, startLevel: number, findFor?: OperationWithLevel<T>): number {
    let level = startLevel;
    while (!levelIsTopFree(fromMs, toMs, level, findFor)) {
      level++;
    }
    return level;
  }

  function findLevelIntersection(level: number): [OperationWithLevel<T>, OperationWithLevel<T>] | undefined {
    if (!level2ops[level] || level2ops[level].length < 2) {
      return undefined;
    }
    for (let i = 0; i < level2ops[level].length; i++) {
      const op = level2ops[level][i];
      const intersector = findIntersection(op);
      if (intersector) {
        return [op, intersector];
      }
    }
    return undefined;
  }

  function findCommonAncestor(
    op1: OperationWithLevel<T>,
    op2: OperationWithLevel<T>
  ): OperationWithLevel<T> | undefined {
    const op1ancestors = getAncestors(op1);
    let parent: OperationWithLevel<T> | undefined = op2;
    while (parent) {
      if (op1ancestors.includes(parent)) {
        return parent;
      }
      parent = parent.parent;
    }
    return undefined;
  }

  let currentLevel = 0;

  while (currentLevel <= maxLevel) {
    console.log('engaging level ', currentLevel);
    while (true) {
      const result = findLevelIntersection(currentLevel);
      if (!result) {
        break;
      }
      const [op1, op2] = result;
      console.log('intersect', op1, op2);
      const commonParent = findCommonAncestor(op1, op2);
      console.log('commonParent', commonParent);
      if (!commonParent) {
        const [minMs, maxMs] = findMaxBounds(op2.operation);
        const newLevel = findTopFreeLevel(minMs, maxMs, currentLevel + 1, op2) + 1;
        changeLevel(op2, newLevel);
      } else {
        const ancestor1 = findAncestorOf(commonParent.children, op1);
        const ancestor2 = findAncestorOf(commonParent.children, op2);
        if (ancestor1 && ancestor2) {
          let toMove = ancestor1?.operation.startMs > ancestor2?.operation.startMs ? ancestor1 : ancestor2;
          currentLevel = toMove.level;
          const newLevel =
            findTopFreeLevel(
              toMove.operation.startMs,
              toMove.operation.startMs + toMove.operation.durationMs,
              currentLevel + 1,
              toMove
            ) + 1;
          changeLevel(toMove, newLevel);
        } else {
          console.error('wtf');
        }
      }
    }
    currentLevel++;
  }

  return operationList;
}

function findAncestorOf<T>(
  candidates: Array<OperationWithLevel<T>>,
  operation: OperationWithLevel<T>
): OperationWithLevel<T> | undefined {
  let parent: OperationWithLevel<T> | undefined = operation;
  while (parent) {
    if (candidates.includes(parent)) {
      return parent;
    }
    parent = parent.parent;
  }
  return undefined;
}

function getAncestors<T>(operation: OperationWithLevel<T>): Array<OperationWithLevel<T>> {
  const ancestors = [];
  let parent = operation.parent;
  while (parent) {
    ancestors.push(parent);
    parent = parent.parent;
  }
  return ancestors;
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
