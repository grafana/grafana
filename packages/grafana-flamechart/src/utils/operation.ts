import { Operation } from '../types';

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
