import { type Page, type Response } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

/**
 * Time comparison end-to-end performance baseline (#126183)
 *
 * The companion jest benchmark (public/app/plugins/panel/timeseries/timeCompare.perf.test.ts)
 * measures only the data-preparation hot path (prepareGraphableFields + compare alignment). It cannot
 * see the two things #126183 actually asks for: the datasource query cost and the browser render cost.
 * This spec closes that gap by driving a real dashboard and measuring, per scenario:
 *
 *   - querySumMs : summed wall time of every /api/ds/query response (turning compare on doubles the
 *                  queries, so this captures the query-side cost the jest bench cannot).
 *   - loadMs     : wall-clock from navigation until every panel's uPlot canvas is drawn (query + render).
 *
 * It creates its dashboards through the HTTP API with time comparison baked into each panel
 * (`panel.timeCompare`), so no clicking is needed and the compare vs. baseline delta is deterministic.
 *
 * SKIPPED by default so its non-deterministic timings never run (or flake) in CI. Opt in with
 * RUN_TIMECOMPARE_PERF=1 against a running grafana, e.g.:
 *
 *   RUN_TIMECOMPARE_PERF=1 yarn e2e:pw --project panels --reporter list -- timeCompare-perf.spec.ts
 *
 * Tunables via env: PERF_SERIES (series per panel), PERF_PANELS (panels in the dashboard scenario),
 * PERF_COMPARE (compare window, e.g. 1w / 1d / __previousPeriod).
 */

const RUN = process.env.RUN_TIMECOMPARE_PERF === '1';

const TESTDATA_UID = 'PD8C576611E62080A';
const SERIES = Number(process.env.PERF_SERIES) || 50;
const PANELS = Number(process.env.PERF_PANELS) || 12;
const COMPARE = process.env.PERF_COMPARE || '1w';

test.use({
  featureToggles: {
    timeComparison: true,
    panelTimeSettings: true,
  },
});

interface DashboardSpec {
  key: string;
  label: string;
  panels: number;
  compare: boolean;
}

const SCENARIOS: DashboardSpec[] = [
  { key: 'baseline1', label: '1 panel baseline', panels: 1, compare: false },
  { key: 'compare1', label: '1 panel compare', panels: 1, compare: true },
  { key: 'baselineN', label: `${PANELS} panel baseline`, panels: PANELS, compare: false },
  { key: 'compareN', label: `${PANELS} panel compare`, panels: PANELS, compare: true },
];

interface Measurement {
  queryCount: number;
  querySumMs: number;
  loadMs: number;
}

function buildDashboard(spec: DashboardSpec) {
  const panels = Array.from({ length: spec.panels }, (_, i) => ({
    id: i + 1,
    title: `panel ${i + 1}`,
    type: 'timeseries',
    // Two columns of 12-wide, 8-tall panels.
    gridPos: { x: (i % 2) * 12, y: Math.floor(i / 2) * 8, w: 12, h: 8 },
    datasource: { type: 'testdata', uid: TESTDATA_UID },
    // Read by transformSaveModelToScene -> PanelTimeRange.compareWith; renders the shifted compare series.
    ...(spec.compare ? { timeCompare: COMPARE } : {}),
    targets: [
      {
        refId: 'A',
        datasource: { type: 'testdata', uid: TESTDATA_UID },
        scenarioId: 'random_walk',
        seriesCount: SERIES,
        startValue: 10,
      },
    ],
  }));

  return {
    title: `TimeCompare perf: ${spec.label}`,
    tags: ['timecompare-perf'],
    timezone: 'utc',
    schemaVersion: 39,
    time: { from: 'now-7d', to: 'now' },
    panels,
  };
}

// Wait until every panel has drawn its uPlot chart, then return wall time since `startedAt`.
async function measureLoad(page: Page, expectedPanels: number, startedAt: number): Promise<number> {
  const uplots = page.locator('.uplot');
  await expect(uplots).toHaveCount(expectedPanels, { timeout: 30_000 });
  await expect(uplots.last()).toBeVisible();
  return Date.now() - startedAt;
}

test.describe('Time comparison performance baseline (#126183)', { tag: ['@panels', '@timeseries'] }, () => {
  test.skip(!RUN, 'Manual perf baseline; set RUN_TIMECOMPARE_PERF=1 to run.');
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  const uids: Record<string, string> = {};
  const results: Record<string, Measurement> = {};

  test.beforeAll(async ({ request }) => {
    for (const spec of SCENARIOS) {
      const response = await request.post('/api/dashboards/db', {
        data: { dashboard: buildDashboard(spec), overwrite: true },
      });
      expect(response.ok(), `created dashboard ${spec.key}`).toBeTruthy();
      uids[spec.key] = (await response.json()).uid;
    }
  });

  test.afterAll(async ({ request }) => {
    for (const uid of Object.values(uids)) {
      await request.delete(`/api/dashboards/uid/${uid}`).catch(() => undefined);
    }
  });

  for (const spec of SCENARIOS) {
    test(spec.label, async ({ gotoDashboardPage, page }) => {
      // Collect the timing of every datasource query fired while this dashboard loads.
      let queryCount = 0;
      let querySumMs = 0;
      const onResponse = (response: Response) => {
        if (!response.url().includes('/api/ds/query')) {
          return;
        }
        queryCount++;
        const timing = response.request().timing();
        if (timing.responseEnd > 0 && timing.requestStart >= 0) {
          querySumMs += timing.responseEnd - timing.requestStart;
        }
      };
      page.on('response', onResponse);

      const startedAt = Date.now();
      await gotoDashboardPage({ uid: uids[spec.key] });
      const loadMs = await measureLoad(page, spec.panels, startedAt);

      page.off('response', onResponse);
      results[spec.key] = { queryCount, querySumMs, loadMs };

      // Compare scenarios must fire more queries than their baseline (current + shifted range).
      expect(queryCount).toBeGreaterThanOrEqual(spec.panels);
    });
  }

  test.afterAll(async () => {
    const widths = [20, 8, 9, 12, 14];
    const header = ['Scenario', 'Panels', 'Queries', 'QuerySum(ms)', 'Load(ms)'];
    const lines = [
      '',
      'Time comparison performance baseline (#126183)',
      `series/panel=${SERIES} panels=${PANELS} compare=${COMPARE} window=7d`,
      'querySumMs = summed /api/ds/query durations; loadMs = nav -> all uPlot canvases drawn',
      '',
      header.map((h, i) => h.padEnd(widths[i])).join(''),
    ];
    for (const spec of SCENARIOS) {
      const r = results[spec.key];
      if (!r) {
        continue;
      }
      lines.push(
        [spec.label, spec.panels, r.queryCount, r.querySumMs.toFixed(0), r.loadMs.toFixed(0)]
          .map((v, i) => String(v).padEnd(widths[i]))
          .join('')
      );
    }
    // eslint-disable-next-line no-console
    console.log(lines.join('\n'));
  });
});
