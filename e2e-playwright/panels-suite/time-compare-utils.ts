import { type Page } from '@playwright/test';

import { expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

/** A single intercepted POST to the datasource query API. */
export interface RecordedQueryRequest {
  /** Epoch milliseconds, as serialized by DataSourceWithBackend. */
  from: number;
  to: number;
  refIds: string[];
}

export interface QueryRecorder {
  /** Every request the mock has fulfilled so far, in arrival order. */
  requests: RecordedQueryRequest[];
  /**
   * Resolves once a request carrying exactly `refIds` has been recorded. Gates assertions on a
   * positive signal instead of a bare timeout, and lets a test assert a request is *absent*
   * only after a related one has demonstrably arrived.
   */
  waitForRequest(refIds: string[]): Promise<RecordedQueryRequest>;
  /** Drops recorded requests, so a re-query can be asserted without matching the initial load. */
  reset(): void;
}

const COMPARE_REF_ID_SUFFIX = '-compare';

/**
 * How a refId listed in `emptyRefIds` should report "no data". Datasources express this both ways
 * and timeShiftAlignmentProcessor branches on the difference: with no frames at all it synthesizes
 * placeholder series from the request targets, whereas a declared-but-empty frame is passed
 * through as-is.
 */
export type EmptyResponseShape = 'no-frames' | 'empty-frame';

export interface MockQueryApiOptions {
  /** refIds that should return no data, mapped to the shape used to express it. */
  emptyRefIds?: Record<string, EmptyResponseShape>;
}

/**
 * Intercepts the datasource query API and returns deterministic frames, recording the time range
 * and refIds of every request.
 *
 * Time comparison issues a *second* query with a shifted range and `-compare` suffixed refIds, so
 * the fan-out is only observable on the wire. Responses must be keyed by refId because
 * toDataQueryResponse looks results up by the refIds it sent.
 *
 * Must be installed before navigating to the dashboard.
 */
export async function mockQueryApi(
  page: Page,
  selectors: E2ESelectorGroups,
  options: MockQueryApiOptions = {}
): Promise<QueryRecorder> {
  const requests: RecordedQueryRequest[] = [];
  const emptyRefIds = options.emptyRefIds ?? {};

  await page.route(selectors.apis.DataSource.queryPattern, async (route) => {
    const body = route.request().postDataJSON();
    const queries: Array<{ refId: string }> = body?.queries ?? [];
    const refIds = queries.map((query) => query.refId);

    // Only the testdata refIds this fixture owns are faked; anything else (e.g. annotations)
    // reaches the real backend so the mock stays as narrow as possible.
    if (!refIds.length || !refIds.every((refId) => /^[A-F](-compare)?$/.test(refId))) {
      await route.continue();
      return;
    }

    const from = Number(body.from);
    const to = Number(body.to);
    // Recorded even when the response is empty, so a test can tell "returned no data" apart from
    // "was never queried".
    requests.push({ from, to, refIds });

    const results: Record<string, unknown> = {};
    for (const refId of refIds) {
      const emptyShape = emptyRefIds[refId];
      results[refId] = {
        status: 200,
        frames:
          emptyShape === 'no-frames'
            ? []
            : emptyShape === 'empty-frame'
              ? [buildEmptyFrame(refId)]
              : [buildFrame(refId, from, to)],
      };
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results }),
    });
  });

  return {
    requests,
    reset: () => {
      requests.length = 0;
    },
    waitForRequest: async (refIds: string[]) => {
      // Reported as the polled value rather than in `message` so the failure names the requests
      // seen by the final attempt, not the (empty) set at the time the matcher was built.
      await expect
        .poll(() =>
          requests.some((request) => arrayEquals(request.refIds, refIds))
            ? `saw [${refIds.join(', ')}]`
            : `expected [${refIds.join(', ')}], saw ${describe(requests)}`
        )
        .toBe(`saw [${refIds.join(', ')}]`);

      return requests.find((request) => arrayEquals(request.refIds, refIds))!;
    },
  };
}

/**
 * The series label a refId renders under. Kept stable across a refId and its `-compare` twin so
 * the pair shares a legend name, and derived from a single label key with a `Value` field name so
 * calculateFieldDisplayName resolves to just the label (plus the " (comparison)" suffix).
 */
export function seriesLabelFor(refId: string) {
  return `${refId.replace(COMPARE_REF_ID_SUFFIX, '')}-series`;
}

/**
 * Builds a timeseries frame spanning the requested window. Values differ between the primary and
 * comparison series so a rendered-output assertion can tell them apart, and timestamps stay inside
 * the requested range so the panel does not report data outside the time range.
 */
function buildFrame(refId: string, from: number, to: number) {
  const isCompare = refId.endsWith(COMPARE_REF_ID_SUFFIX);
  const pointCount = 6;
  const step = (to - from) / (pointCount - 1);

  const times: number[] = [];
  const values: number[] = [];
  for (let i = 0; i < pointCount; i++) {
    times.push(Math.round(from + step * i));
    values.push(isCompare ? 10 + i : 100 + i);
  }

  return {
    schema: {
      refId,
      meta: { type: 'timeseries-multi', typeVersion: [0, 1] },
      fields: [
        { name: 'time', type: 'time', typeInfo: { frame: 'time.Time' } },
        {
          name: 'Value',
          type: 'number',
          typeInfo: { frame: 'float64' },
          labels: { series: seriesLabelFor(refId) },
        },
      ],
    },
    data: { values: [times, values] },
  };
}

/**
 * A frame that declares its fields but carries no points — the other way a datasource reports an
 * empty window, which takes a different branch through timeShiftAlignmentProcessor than omitting
 * the frame entirely.
 */
function buildEmptyFrame(refId: string) {
  return {
    schema: {
      refId,
      meta: { type: 'timeseries-multi', typeVersion: [0, 1] },
      fields: [
        { name: 'time', type: 'time', typeInfo: { frame: 'time.Time' } },
        {
          name: 'Value',
          type: 'number',
          typeInfo: { frame: 'float64' },
          labels: { series: seriesLabelFor(refId) },
        },
      ],
    },
    data: { values: [[], []] },
  };
}

function arrayEquals(a: string[], b: string[]) {
  return a.length === b.length && a.every((value, idx) => value === b[idx]);
}

function describe(requests: RecordedQueryRequest[]) {
  if (!requests.length) {
    return 'no requests';
  }
  return requests.map((request) => `[${request.refIds.join(', ')}]`).join(', ');
}
