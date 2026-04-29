import type { JestCanvasMockComparePayload } from './types.ts';

/**
 * Narrow the payload type
 * @param payload
 */
export function isCanvasComparePayload(payload: unknown): payload is JestCanvasMockComparePayload {
  if (!payload || typeof payload !== 'object' || !('testName' in payload)) {
    return false;
  }

  return typeof payload.testName === 'string' && 'expected' in payload && 'actual' in payload;
}

/** Reads `snapshotAssertionPassed` from parsed payload JSON when present. */
export function readSnapshotAssertionPassed(data: unknown): boolean | undefined {
  if (!data || typeof data !== 'object') {
    return undefined;
  }
  if (!('snapshotAssertionPassed' in data)) {
    return undefined;
  }
  const v = data.snapshotAssertionPassed;
  return typeof v === 'boolean' ? v : undefined;
}
