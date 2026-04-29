import type { CanvasRenderingContext2DEvent } from 'jest-canvas-mock';

import type { eventsToCanvasScript } from './canvasUtils.ts';

export type { UPlotComparePayload } from './exportedTypes.ts';

export type CanvasEventArray = Parameters<typeof eventsToCanvasScript>[0];

export type ResolvedPayload = {
  testName: string;
  expected: CanvasEventArray;
  actual: CanvasEventArray;
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[];
  width?: number;
  height?: number;
  snapshotAssertionPassed?: boolean;
};

export interface ComparePlotsProps {
  defaultWidth: number;
  defaultHeight: number;
  payload: ResolvedPayload;
}
