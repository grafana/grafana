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
 * Intercepts the datasource query API and returns deterministic frames, recording the time range
 * and refIds of every request.
 *
 * Time comparison issues a *second* query with a shifted range and `-compare` suffixed refIds, so
 * the fan-out is only observable on the wire. Responses must be keyed by refId because
 * toDataQueryResponse looks results up by the refIds it sent.
 *
 * Must be installed before navigating to the dashboard.
 */
export async function mockQueryApi(page: Page, selectors: E2ESelectorGroups): Promise<QueryRecorder> {
  const requests: RecordedQueryRequest[] = [];

  await page.route(selectors.apis.DataSource.queryPattern, async (route) => {
    const body = route.request().postDataJSON();
    const queries: Array<{ refId: string }> = body?.queries ?? [];
    const refIds = queries.map((query) => query.refId);

    // Only the testdata refIds this fixture owns are faked; anything else (e.g. annotations)
    // reaches the real backend so the mock stays as narrow as possible.
    if (!refIds.length || !refIds.every((refId) => /^[ABCD](-compare)?$/.test(refId))) {
      await route.continue();
      return;
    }

    const from = Number(body.from);
    const to = Number(body.to);
    requests.push({ from, to, refIds });

    const results: Record<string, unknown> = {};
    for (const refId of refIds) {
      results[refId] = {
        status: 200,
        frames: [buildFrame(refId, from, to)],
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
      await expect
        .poll(() => requests.some((request) => arrayEquals(request.refIds, refIds)), {
          message: `expected a query request for refIds [${refIds.join(', ')}], saw ${describe(requests)}`,
        })
        .toBe(true);

      return requests.find((request) => arrayEquals(request.refIds, refIds))!;
    },
  };
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
        { name: refId, type: 'number', typeInfo: { frame: 'float64' } },
      ],
    },
    data: { values: [times, values] },
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
