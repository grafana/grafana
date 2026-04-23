import { type MatcherContext } from 'expect';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type Context, toMatchSnapshot } from 'jest-snapshot';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type UPlotComparePayload } from '@grafana/uplot-compare';

import { createUPlotComparePayloadBasename } from '../uplotComparePayload';

export type ToMatchSnapshotRest = Parameters<typeof toMatchSnapshot> extends [unknown, ...infer R] ? R : never;

type UPlotSnapshotSize = {
  width: number;
  height: number;
};

type SnapshotMismatch = jest.CustomMatcherResult & {
  expected?: string;
};

export function toMatchUPlotSnapshot(
  this: MatcherContext,
  received: CanvasRenderingContext2DEvent[],
  uPlotCanvasEvents: CanvasRenderingContext2DEvent[],
  size: UPlotSnapshotSize,
  snapshotHint?: string,
  ...rest: ToMatchSnapshotRest
): jest.CustomMatcherResult {
  const payloadWidth = size.width;
  const payloadHeight = size.height;

  const [propertiesOrHint, hint] = rest;
  const snapshotName = snapshotHint ?? hint;
  const snapshotContext = this as Context;
  const result = (
    propertiesOrHint
      ? toMatchSnapshot.call(snapshotContext, received, propertiesOrHint, snapshotName)
      : snapshotName
        ? toMatchSnapshot.call(snapshotContext, received, snapshotName)
        : toMatchSnapshot.call(snapshotContext, received)
  ) as SnapshotMismatch;

  if (!process.env.CI && !result.pass && result.expected != null) {
    let parsedExpected;
    try {
      parsedExpected = parseSnapshotJson(result.expected) as CanvasRenderingContext2DEvent[];
    } catch (e) {
      console.error('toMatchUPlotSnapshot: failed to parse expected snapshot JSON', e);
      return result;
    }

    const testName = this.currentTestName ?? '';
    const payload: UPlotComparePayload = {
      testName,
      expected: parsedExpected,
      actual: received,
      uPlotCanvasEvents: uPlotCanvasEvents,
      width: payloadWidth,
      height: payloadHeight,
    };

    const { fullPath, publicBasename } = resolveUPlotComparePayloadWriteTarget(testName);
    try {
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, `${JSON.stringify(payload)}\n`, 'utf8');
      const compareUrl = new URL('http://localhost:5173/');
      compareUrl.searchParams.set('file', publicBasename);
      // Use stderr so jest-fail-on-console (console.* hooks) does not treat this as a test failure
      process.stderr.write(
        `To debug this diff visually, run \`yarn uplot-compare\`, then open:\n\n${compareUrl.toString()}\n\n(Payload written to ${fullPath})\n`
      );
    } catch (e) {
      console.warn(
        `[toMatchUPlotSnapshot] Could not write compare payload to ${fullPath}:`,
        e instanceof Error ? e.message : e
      );
    }
  }

  return result;
}

/**
 * Snapshot is almost JSON, clean it up so it will parse
 * Not meant to be used outside of the canvas snapshot use-case
 * @param text
 */
function parseSnapshotJson(text: string) {
  const withoutTrailingCommas = text.replace(/,(\s*[}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

/**
 * Return public and filesystem paths
 * @param testName
 */
function resolveUPlotComparePayloadWriteTarget(testName: string): { fullPath: string; publicBasename: string } {
  const fromEnv = process.env.UPLOT_COMPARE_PAYLOAD_FILE;
  if (fromEnv) {
    const fullPath = path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    return { fullPath, publicBasename: path.basename(fullPath) };
  }
  const basename = createUPlotComparePayloadBasename(testName);
  const uplotCompareRoot = path.join(path.dirname(require.resolve('@grafana/uplot-compare')), '..');
  const fullPath = path.join(uplotCompareRoot, 'public', basename);
  return { fullPath, publicBasename: basename };
}
