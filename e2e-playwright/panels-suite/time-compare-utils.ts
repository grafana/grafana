import { type Page } from '@playwright/test';

import { expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

const COMPARE_REF_ID_SUFFIX = '-compare';

/** refIds this fixture owns; anything else (e.g. annotations) reaches the real backend. */
const OWNED_REF_ID = /^[A-F](-compare)?$/;

/**
 * Support testing both ways a datasource may return no data
 */
export type EmptyResponseShape = 'no-frames' | 'empty-frame';

export function seriesLabelFor(refId: string) {
  return `${refId.replace(COMPARE_REF_ID_SUFFIX, '')}-series`;
}

/**
 * Builds a timeseries frame for `refId`.
 * Timestamps span the requested window. Omitting `window` declares the fields but carries no points
 */
function buildFrame(refId: string, window?: { from: number; to: number }) {
  const times: number[] = [];
  const values: number[] = [];

  if (window) {
    const pointCount = 6;
    const step = (window.to - window.from) / (pointCount - 1);
    const base = refId.endsWith(COMPARE_REF_ID_SUFFIX) ? 10 : 100;

    for (let i = 0; i < pointCount; i++) {
      times.push(Math.round(window.from + step * i));
      values.push(base + i);
    }
  }

  return {
    schema: {
      refId,
      meta: { type: 'timeseries-multi', typeVersion: [0, 1] },
      fields: [
        { name: 'time', type: 'time' },
        { name: 'Value', type: 'number', labels: { series: seriesLabelFor(refId) } },
      ],
    },
    data: { values: [times, values] },
  };
}

/**
 * Intercepts the datasource query API and returns deterministic frames, recording the time range
 * and refIds of every request.
 */
export async function mockQueryApi(
  page: Page,
  selectors: E2ESelectorGroups,
  // refIds that should return no data, mapped to the shape used to express it.
  options: { emptyRefIds?: Record<string, EmptyResponseShape> } = {}
) {
  /** Requests the mock has fulfilled, in arrival order. `from`/`to` are epoch milliseconds. */
  const requests: Array<{ from: number; to: number; refIds: string[] }> = [];
  const emptyRefIds = options.emptyRefIds ?? {};

  await page.route(selectors.apis.DataSource.queryPattern, async (route) => {
    const body = route.request().postDataJSON();
    const refIds: string[] = (body?.queries ?? []).map((query: { refId: string }) => query.refId);

    if (!refIds.length || !refIds.every((refId) => OWNED_REF_ID.test(refId))) {
      await route.continue();
      return;
    }

    const from = Number(body.from);
    const to = Number(body.to);
    // Recorded even when the response is empty, so a test can tell "returned no data" apart from "was never queried"
    requests.push({ from, to, refIds });

    const results = Object.fromEntries(
      refIds.map((refId) => {
        const empty = emptyRefIds[refId];
        return [
          refId,
          {
            status: 200,
            frames: empty === 'no-frames' ? [] : [buildFrame(refId, empty ? undefined : { from, to })],
          },
        ];
      })
    );

    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
  });

  const findRequest = (refIds: string[]) =>
    requests.find(
      (request) => request.refIds.length === refIds.length && request.refIds.every((id, idx) => id === refIds[idx])
    );

  return {
    requests,

    reset: () => {
      requests.length = 0;
    },

    // Resolves once a request carrying exactly `refIds` has been recorded.
    waitForRequest: async (refIds: string[]) => {
      const wanted = `saw [${refIds.join(', ')}]`;

      // Reported as the polled value so a failed request is named
      await expect
        .poll(() => {
          if (findRequest(refIds)) {
            return wanted;
          }
          const seen = requests.map((request) => `[${request.refIds.join(', ')}]`).join(', ');
          return `expected [${refIds.join(', ')}], saw ${seen || 'no requests'}`;
        })
        .toBe(wanted);

      return findRequest(refIds)!;
    },
  };
}
