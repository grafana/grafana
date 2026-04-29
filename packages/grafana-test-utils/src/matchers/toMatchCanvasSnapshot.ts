import { type MatcherContext, type ExpectationResult } from 'expect';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type Context, toMatchSnapshot } from 'jest-snapshot';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { type JestCanvasMockComparePayload } from '@grafana/jest-canvas-mock-compare';

import { createCanvasComparePayloadBasename } from '../canvasComparePayload';

export type ToMatchSnapshotRest = Parameters<typeof toMatchSnapshot> extends [unknown, ...infer R] ? R : never;

type CanvasSize = {
  width: number;
  height: number;
};

type SnapshotMismatch = jest.CustomMatcherResult & {
  expected?: string;
};

export function toMatchCanvasSnapshot(
  this: MatcherContext,
  received: CanvasRenderingContext2DEvent[],
  canvasContextEvents: CanvasRenderingContext2DEvent[],
  size: CanvasSize,
  snapshotHint?: string,
  ...rest: ToMatchSnapshotRest
): jest.CustomMatcherResult {
  const payloadWidth = size.width;
  const payloadHeight = size.height;

  const [propertiesOrHint, hint] = rest;
  const snapshotName = snapshotHint ?? hint;
  const snapshotContext = this as Context;
  let baseResult: ExpectationResult;
  if (propertiesOrHint) {
    baseResult = toMatchSnapshot.call(snapshotContext, received, propertiesOrHint, snapshotName);
  } else if (snapshotName) {
    baseResult = toMatchSnapshot.call(snapshotContext, received, snapshotName);
  } else {
    baseResult = toMatchSnapshot.call(snapshotContext, received);
  }
  const result = baseResult as SnapshotMismatch;

  if (!process.env.CI && ((!result.pass && result.expected != null) || process.env.GEN_CANVAS_OUTPUT_ON_PASS)) {
    let expected = result.expected;
    if (!expected) {
      expected = JSON.stringify(received);
    }
    let parsedExpected;
    try {
      parsedExpected = parseSnapshotJson(expected) as CanvasRenderingContext2DEvent[];
    } catch (e) {
      console.error('toMatchCanvasSnapshot: failed to parse expected snapshot JSON', e);
      return result;
    }

    const testName = this.currentTestName ?? '';
    const payload: JestCanvasMockComparePayload = {
      testName,
      testPath: this.testPath,
      expected: parsedExpected,
      actual: received,
      canvasContextEvents: canvasContextEvents,
      width: payloadWidth,
      height: payloadHeight,
      snapshotAssertionPassed: result.pass,
    };

    const { fullPath, publicBasename } = resolveCanvasComparePayloadWriteTarget(testName);
    try {
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, `${JSON.stringify(payload)}\n`, 'utf8');
      const compareUrl = new URL('http://localhost:5173/');
      compareUrl.searchParams.set('file', publicBasename);
      // Use stderr so jest-fail-on-console (console.* hooks) does not treat this as a test failure
      process.stderr.write(
        `To debug this diff visually, run \`yarn canvas-compare\`, then open:\n${compareUrl.toString()}\n(Payload written to ${fullPath})\n\n`
      );
    } catch (e) {
      console.warn(
        `[toMatchCanvasSnapshot] Could not write compare payload to ${fullPath}:`,
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
function resolveCanvasComparePayloadWriteTarget(testName: string): { fullPath: string; publicBasename: string } {
  const basename = createCanvasComparePayloadBasename(testName);
  // Resolve via `package.json` so this does not break if the workspace's main entry moves
  // (e.g. to a built `dist/` folder). `./package.json` is explicitly listed in the workspace's `exports`.
  const compareRoot = path.dirname(require.resolve('@grafana/jest-canvas-mock-compare/package.json'));
  const fullPath = path.join(compareRoot, 'public', basename);
  return { fullPath, publicBasename: basename };
}
