/**
 * Deterministic `measureText` helpers for uPlot canvas snapshot tests.
 *
 * jest-canvas-mock reports `TextMetrics.width === text.length`, which breaks Y/X axis
 * layout compared to the browser. Use {@link createGrafanaUiMeasureTextJestMock} with
 * `jest.mock` and {@link applyDefaultUPlotAxisMeasureTextMock} in `beforeEach`.
 *
 * @example
 * ```ts
 * import { measureText as uPlotAxisMeasureText } from '@grafana/ui';
 * import { applyDefaultUPlotAxisMeasureTextMock } from '@grafana/test-utils/canvas';
 *
 * let uPlotInstance: InstanceType<typeof uPlot> | undefined;
 * jest.mock('@grafana/ui/src/utils/measureText', () =>
 *   require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock(() => uPlotInstance)
 * );
 *
 * beforeEach(() => {
 *   applyDefaultUPlotAxisMeasureTextMock(jest.mocked(uPlotAxisMeasureText));
 *
 *   // Set uPlotInstance by spying on the config builder and adding a hook, or by other means. See SparklineCell.canvas.test.tsx, or HeatmapPanel.canvas.test.tsx for examples
 * });
 * ```
 */

import type uPlot from 'uplot';

/** Use as the `jest.mock()` module string (must be written literally at the call site). */
export const GRAFANA_UI_MEASURE_TEXT_MODULE = '@grafana/ui/src/utils/measureText';

const AXIS_TEXT_WIDTH_PER_CHAR = 7.2;

/** Width scale matched roughly to 12px Inter. */
export function defaultAxisTextWidthForCanvasTests(text: string | null, fontSize: number): number {
  const w = (text?.length ?? 1) * AXIS_TEXT_WIDTH_PER_CHAR * (fontSize / 12);
  return Math.max(8, w);
}

export type GrafanaUiMeasureTextFn = (text: string, fontSize: number, fontWeight?: number) => TextMetrics;

/**
 * Factory for `jest.mock(…, () => …)`.
 * Call via `require('@grafana/test-utils/canvas')` inside the mock factory so Jest hoisting works.
 */
export function createGrafanaUiMeasureTextJestMock(
  getUplotInstance: () => InstanceType<typeof uPlot> | undefined = () => undefined
) {
  const actual = jest.requireActual(GRAFANA_UI_MEASURE_TEXT_MODULE);
  return {
    ...actual,
    measureText: jest.fn(),
    // gradientFills.ts creates linear gradients on the shared measureText canvas
    // (getCanvasContext) — separate from uPlot's own ctx — so the createLinearGradient
    // geometry never lands in uPlotInstance.ctx events and the viewer can't replay it.
    // Routing both to the same ctx makes the snapshot self-contained.
    getCanvasContext: jest.fn(() => getUplotInstance()?.ctx ?? actual.getCanvasContext()),
  };
}

/**
 * Applies browser-like axis label widths. Re-run in `beforeEach` after `mockImplementationOnce`.
 */
export function applyDefaultUPlotAxisMeasureTextMock(measureTextMock: jest.MockedFunction<GrafanaUiMeasureTextFn>) {
  measureTextMock.mockImplementation(
    (text, fontSize, _fontWeight = 400) =>
      ({ width: defaultAxisTextWidthForCanvasTests(text, fontSize) }) as TextMetrics
  );
}
