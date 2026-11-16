/** Space between the boxes on the home page, in theme spacing units: the gap the KPI tiles use. */
export const BOX_GAP = 1.5;

/** Every chart on the details tabs is this tall, in pixels, so the boxes in a row and across tabs match. */
export const CHART_HEIGHT = 300;

/** Fixes a chart's height, replacing whatever the Insights scene asked for. */
export function withChartHeight<T extends { setState: (state: { height: number; minHeight: number }) => void }>(
  chart: T
): T {
  chart.setState({ height: CHART_HEIGHT, minHeight: CHART_HEIGHT });
  return chart;
}
