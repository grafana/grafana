import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type Context, toMatchSnapshot } from 'jest-snapshot';
import type uPlot from 'uplot';

export type ToMatchSnapshotRest = Parameters<typeof toMatchSnapshot> extends [unknown, ...infer R] ? R : never;

type SnapshotMismatch = jest.CustomMatcherResult & {
  expected?: string;
};

export function toMatchUPlotSnapshot(
  this: Context,
  received: CanvasRenderingContext2DEvent[],
  data: uPlot.AlignedData,
  series: uPlot.Series[],
  ...rest: ToMatchSnapshotRest
): jest.CustomMatcherResult {
  const result = toMatchSnapshot.call(this, received, ...rest) as SnapshotMismatch; // @todo how to properly get actual from jest?

  if (!result.pass && result.expected != null) {
    const parsedExpected = parseSnapshotJson(result.expected) as CanvasRenderingContext2DEvent[];
    const expectedUrlParam = encodeURIComponent(JSON.stringify(parsedExpected));
    const actualUrlParam = encodeURIComponent(JSON.stringify(received));
    const dataUrlParam = encodeURIComponent(JSON.stringify(data));
    const seriesUrlParam = series ? encodeURIComponent(JSON.stringify(series)) : '';
    const testName = encodeURIComponent(this.currentTestName ?? '');

    // @todo add types and builder for this url
    console.log(
      'To debug this diff visually, run `yarn uplot-compare:build && uplot-compare:serve`, then visit:',
      `\nhttp://localhost:5173?expected=${expectedUrlParam}&actual=${actualUrlParam}&uPlotData=${dataUrlParam}&uPlotSeries=${seriesUrlParam}&testName=${testName}`
    );
  }

  return result;
}

export function parseSnapshotJson(text: string) {
  const withoutTrailingCommas = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}
