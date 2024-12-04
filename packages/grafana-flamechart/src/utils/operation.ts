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
