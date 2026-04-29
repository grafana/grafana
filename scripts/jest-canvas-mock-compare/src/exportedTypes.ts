import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

/** JSON payload written for `yarn workspace @grafana/jest-canvas-mock-compare dev` when a canvas snapshot runs locally. */
export interface JestCanvasMockComparePayload {
  testName: string;
  /** Absolute path to the test file; used by jest-canvas-mock-compare to run `jest -u` for Accept baseline. */
  testPath?: string;
  /**
   * serialized output of snapshot test
   */
  expected: unknown;
  /**
   * serialized output from snapshot file
   */
  actual: unknown;
  /**
   * additional canvas context outside the scope of the test assertion. These events will be rendered in the panel
   */
  canvasContextEvents: CanvasRenderingContext2DEvent[];
  /** test canvas width (CSS px) */
  width: number;
  /** test canvas height (CSS px) */
  height: number;
  /** whether the Jest snapshot assertion passed when the test last failed (or was run with GEN_CANVAS_OUTPUT_ON_PASS). */
  snapshotAssertionPassed?: boolean;
}
