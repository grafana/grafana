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
 * jest.mock('@grafana/ui/src/utils/measureText', () =>
 *   require('@grafana/test-utils/canvas').createGrafanaUiMeasureTextJestMock()
 * );
 *
 * beforeEach(() => {
 *   applyDefaultUPlotAxisMeasureTextMock(uPlotAxisMeasureText as jest.MockedFunction<typeof uPlotAxisMeasureText>);
 * });
 * ```
 */

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
export function createGrafanaUiMeasureTextJestMock() {
  const actual = jest.requireActual(GRAFANA_UI_MEASURE_TEXT_MODULE);
  return { ...actual, measureText: jest.fn() };
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
