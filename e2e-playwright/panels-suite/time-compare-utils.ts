import { type Locator, type Page, type Request } from '@playwright/test';

import { expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

/**
 * Support testing both ways a datasource may return no data
 */
export type EmptyResponseShape = 'no-frames' | 'empty-frame';

/**
 * A request the fixture has seen. `from`/`to` are epoch milliseconds. `seq` counts up as requests
 * are sent and keeps counting after a `reset`, so it can be used to tell which came first.
 */
type RecordedRequest = { from: number; to: number; refIds: string[]; seq: number };

export type QueryApiRecorder = {
  requests: RecordedRequest[];
  reset: () => void;
  waitForRequest: (refIds: string[], options?: { after?: RecordedRequest }) => Promise<RecordedRequest>;
};

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
    const base = refId.endsWith('-compare') ? 10 : 100;

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
        { name: 'Value', type: 'number', labels: { series: `${refId}-series` } },
      ],
    },
    data: { values: [times, values] },
  };
}

/**
 * The refIds of a panel query request, or undefined if this is not one.
 *
 * The fixture dashboard declares no annotations or variables, so every request to this endpoint is
 * a panel query. Rather than allowlisting the fixture's refIds - which would silently ignore a new
 * panel's queries and make waitForRequest fail as "saw no requests" - anything that is not a panel
 * query is excluded by shape.
 */
function panelQueryRefIds(request: Request): string[] | undefined {
  if (request.method() !== 'POST' || !request.url().includes('/api/ds/query')) {
    return undefined;
  }

  let body;
  try {
    body = request.postDataJSON();
  } catch {
    return undefined;
  }

  const queries: Array<{ refId?: string }> = body?.queries ?? [];
  if (!queries.length || !queries.every((query) => typeof query.refId === 'string' && query.refId)) {
    return undefined;
  }

  return queries.map((query) => query.refId!);
}

/**
 * Records the time range and refIds of every datasource query request, without intercepting any of
 * them, so responses come from the real backend.
 */
export function observeQueryApi(page: Page): QueryApiRecorder {
  const requests: RecordedRequest[] = [];
  let nextSeq = 0;

  page.on('request', (request) => {
    const refIds = panelQueryRefIds(request);
    if (!refIds) {
      return;
    }
    const body = request.postDataJSON();
    requests.push({ from: Number(body.from), to: Number(body.to), refIds, seq: nextSeq++ });
  });

  const findRequest = (refIds: string[], after?: RecordedRequest) =>
    requests.find(
      (request) =>
        (after === undefined || request.seq > after.seq) &&
        request.refIds.length === refIds.length &&
        request.refIds.every((id, idx) => id === refIds[idx])
    );

  return {
    requests,

    reset: () => {
      requests.length = 0;
    },

    /**
     * Resolves once a request carrying exactly `refIds` has been recorded.
     *
     * Pass `after` to only match a request sent after that one. A panel sends its primary and
     * compare queries one after the other, so when the range keeps refreshing you can end up
     * matching a compare from one refresh against a primary from the next. Anchoring the compare
     * to its own primary keeps the pair together.
     */
    waitForRequest: async (refIds: string[], options: { after?: RecordedRequest } = {}) => {
      const { after } = options;
      const anchor = after ? ` after [${after.refIds.join(', ')}]` : '';
      const wanted = `saw [${refIds.join(', ')}]${anchor}`;

      // Reported as the polled value so a failed request is named
      await expect
        .poll(() => {
          if (findRequest(refIds, after)) {
            return wanted;
          }
          const seen = requests.map((request) => `[${request.refIds.join(', ')}]`).join(', ');
          return `expected [${refIds.join(', ')}]${anchor}, saw ${seen || 'no requests'}`;
        })
        .toBe(wanted);

      return findRequest(refIds, after)!;
    },
  };
}

/**
 * Serves every panel query, returning no data for the refIds named in `emptyRefIds`.
 *
 * This will have timing issues if mixed with real API calls
 */
export async function mockQueryApi(
  page: Page,
  selectors: E2ESelectorGroups,
  // refIds that should return no data, mapped to the shape used to express it.
  options: { emptyRefIds: Record<string, EmptyResponseShape> }
) {
  const recorder = observeQueryApi(page);
  const { emptyRefIds } = options;

  await page.route(selectors.apis.DataSource.queryPattern, async (route) => {
    const request = route.request();
    const refIds = panelQueryRefIds(request);

    if (!refIds) {
      await route.continue();
      return;
    }

    const body = request.postDataJSON();
    const from = Number(body.from);
    const to = Number(body.to);

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

  return recorder;
}

/**
 * The panel's legend, once uPlot has drawn. Gating on the draw keeps assertions about which series
 * are present from passing before the panel has rendered any.
 */
export async function drawnLegend(panel: Locator, selectors: E2ESelectorGroups) {
  await expect(panel.locator('.u-over')).toBeVisible();
  return panel.getByTestId(selectors.components.VizLegend.legend);
}
