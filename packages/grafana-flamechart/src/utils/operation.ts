import { Operation } from '../types';

// find min from and max to for entire op tree
export function findMaxBounds<T>(operation: Operation<T>): [number, number] {
  let min = operation.startMs;
  let max = operation.startMs + operation.durationMs;
  operation.children.forEach((child) => {
    const [childMin, childMax] = findMaxBounds(child);
    min = Math.min(min, childMin);
    max = Math.max(max, childMax);
  });
  return [min, max];
}

// find min and max to for leftmost branch of tree
export function findMaxBoundsLeft<T>(operation: Operation<T>): [number, number] {
  let min = operation.startMs;
  let max = operation.startMs + operation.durationMs;
  const firstChild = operation.children[0];
  if (firstChild) {
    const [childMin, childMax] = findMaxBoundsLeft(firstChild);
    min = Math.min(min, childMin);
    max = Math.max(max, childMax);
  }
  return [min, max];
}

export function isRelatedTo<T>(operation: Operation<T>, otherOp: Operation<T>): boolean {
  return isDescendantOf(operation, otherOp) || isDescendantOf(otherOp, operation);
}

export function isDescendantOf<T>(operation: Operation<T>, parent: Operation<T>): boolean {
  let p: Operation<T> | undefined = operation;
  while (p) {
    if (p === parent) {
      return true;
    }
    p = p.parent;
  }
  return false;
}
