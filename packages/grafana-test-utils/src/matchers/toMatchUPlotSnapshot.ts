import { type MatcherContext } from 'expect';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type Context, toMatchSnapshot } from 'jest-snapshot';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type uPlot from 'uplot';

import {
  createUplotComparePayloadBasename,
  UPLOT_COMPARE_PAYLOAD_VERSION,
  type UPlotComparePayloadV1,
} from '../uplotComparePayload';

export type ToMatchSnapshotRest = Parameters<typeof toMatchSnapshot> extends [unknown, ...infer R] ? R : never;

type UPlotSnapshotSize = {
  width?: number;
  height?: number;
};

type SnapshotMismatch = jest.CustomMatcherResult & {
  expected?: string;
};

export function toMatchUPlotSnapshot(
  this: MatcherContext,
  received: CanvasRenderingContext2DEvent[],
  data: uPlot.AlignedData,
  series: uPlot.Series[],
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[],
  size?: UPlotSnapshotSize,
  snapshotHint?: string,
  ...rest: ToMatchSnapshotRest
): jest.CustomMatcherResult {
  const payloadWidth = size?.width;
  const payloadHeight = size?.height;
  const [propertiesOrHint, hint] = rest;
  const snapshotName = snapshotHint ?? hint;
  const snapshotContext = this as Context;
  const result = (
    propertiesOrHint !== undefined
      ? toMatchSnapshot.call(snapshotContext, received, propertiesOrHint, snapshotName)
      : snapshotName !== undefined
        ? toMatchSnapshot.call(snapshotContext, received, snapshotName)
        : toMatchSnapshot.call(snapshotContext, received)
  ) as SnapshotMismatch; // @todo how to properly get actual from jest?

  if (!result.pass && result.expected != null) {
    const parsedExpected = parseSnapshotJson(result.expected) as CanvasRenderingContext2DEvent[];
    const testName = this.currentTestName ?? '';

    const payload: UPlotComparePayloadV1 = {
      version: UPLOT_COMPARE_PAYLOAD_VERSION,
      testName,
      expected: parsedExpected,
      actual: received,
      uPlotData: data,
      uPlotSeries: series,
      uPlotCanvasEvents: uPlotCanvasEvents,
      ...(payloadWidth !== undefined && { width: payloadWidth }),
      ...(payloadHeight !== undefined && { height: payloadHeight }),
    };

    const { fullPath, publicBasename } = resolveUplotComparePayloadWriteTarget(testName);
    try {
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, `${JSON.stringify(payload)}\n`, 'utf8');
      const compareUrl = new URL('http://localhost:5173/');
      compareUrl.searchParams.set('file', publicBasename);
      console.log(
        'To debug this diff visually, run `yarn workspace uplot-compare dev`, then open:',
        `\n\n${compareUrl.toString()}`,
        `\n\n(Payload written to ${fullPath})`
      );
    } catch (e) {
      console.warn(
        `[toMatchUPlotSnapshot] Could not write compare payload to ${fullPath}:`,
        e instanceof Error ? e.message : e
      );
      console.log(
        'Save this JSON manually and load it in uplot-compare (paste or file picker):',
        JSON.stringify(payload)
      );
    }
  }

  return result;
}

function parseSnapshotJson(text: string) {
  const withoutTrailingCommas = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

function resolveUplotComparePayloadWriteTarget(testName: string): { fullPath: string; publicBasename: string } {
  const fromEnv = process.env.UPLOT_COMPARE_PAYLOAD_FILE;
  if (fromEnv) {
    const fullPath = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    return { fullPath, publicBasename: path.basename(fullPath) };
  }
  const basename = createUplotComparePayloadBasename(testName);
  const fullPath = path.join(__dirname, '../../../../scripts/uplot-compare/public', basename);
  return { fullPath, publicBasename: basename };
}
