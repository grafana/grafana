import { type APIRequestContext, type Locator, type Page, expect } from '@playwright/test';

import testDashboard from '../dashboards/BiCrossFilterTest.json';

// The fixture dashboard has three Prometheus panels (gdev-prometheus): bar charts grouped by region and by
// product, and a table grouped by both. Queries are answered by mockPrometheus below, which evaluates the
// label matchers Grafana adds to each expression against a small in-memory dataset. So the specs check what
// Grafana sends and renders, not Prometheus itself.
export const REGIONS = ['North', 'South', 'East', 'West'];
export const PRODUCTS = ['Widget', 'Gadget', 'Gizmo'];

const ROWS = REGIONS.flatMap((region, i) =>
  PRODUCTS.map((product, j) => ({ region, product, revenue: 10 + 7 * (i * PRODUCTS.length + j) }))
);
type Row = (typeof ROWS)[number];

function labelOf(row: Row, key: string): string | undefined {
  return key === 'region' ? row.region : key === 'product' ? row.product : undefined;
}

/** Label matchers inside the selector braces, e.g. revenue{region=~"North|South",product="Widget"}. */
function matchers(expr: string): Array<{ key: string; op: string; value: string }> {
  const selector = /\{([^}]*)\}/.exec(expr)?.[1] ?? '';
  return [...selector.matchAll(/(\w+)\s*(=~|!~|!=|=)\s*"([^"]*)"/g)].map(([, key, op, value]) => ({ key, op, value }));
}

function matches(row: Row, { key, op, value }: { key: string; op: string; value: string }): boolean {
  const actual = labelOf(row, key) ?? '';
  const anyOf = value.split('|');
  switch (op) {
    case '=':
      return actual === value;
    case '!=':
      return actual !== value;
    case '=~':
      return anyOf.includes(actual);
    case '!~':
      return !anyOf.includes(actual);
    default:
      return true;
  }
}

/** Grouping labels of a `sum by(a, b) (...)` expression; identifies which panel sent it. */
export function groupingOf(expr: string): string {
  return /sum by\(([^)]*)\)/.exec(expr)?.[1].replace(/\s/g, '') ?? '';
}

/**
 * Answers /api/ds/query like Prometheus would for the fixture and records every expression sent, newest last.
 * Returns the log so specs can assert which panel's request carried which filters.
 */
export async function mockPrometheus(page: Page): Promise<string[]> {
  const sent: string[] = [];
  await page.route(/\/api\/ds\/query/, async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}');
    const results: Record<string, unknown> = {};
    for (const query of body.queries ?? []) {
      const expr: string = query.expr ?? '';
      sent.push(expr);
      const keys = groupingOf(expr).split(',').filter(Boolean);
      const rows = ROWS.filter((row) => matchers(expr).every((m) => matches(row, m)));
      const groups = new Map<string, { labels: Record<string, string>; value: number }>();
      for (const row of rows) {
        const id = keys.map((k) => labelOf(row, k)).join('|');
        const group = groups.get(id) ?? {
          labels: Object.fromEntries(keys.map((k) => [k, labelOf(row, k) ?? ''])),
          value: 0,
        };
        group.value += row.revenue;
        groups.set(id, group);
      }
      results[query.refId] = {
        status: 200,
        frames: [...groups.values()].map((group) => ({
          schema: {
            refId: query.refId,
            meta: { type: 'numeric-multi', typeVersion: [0, 1], custom: { resultType: 'vector' } },
            fields: [
              { name: 'Time', type: 'time', typeInfo: { frame: 'time.Time' } },
              { name: 'Value', type: 'number', typeInfo: { frame: 'float64' }, labels: group.labels },
            ],
          },
          data: { values: [[Date.now()], [group.value]] },
        })),
      };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results }) });
  });
  return sent;
}

/** The newest expression sent by the panel grouped by `grouping`, e.g. 'region' or 'region,product'. */
export function latestExpr(sent: string[], grouping: string): string | undefined {
  return [...sent].reverse().find((expr) => groupingOf(expr) === grouping);
}

/** Expressions the panel grouped by `grouping` sent after index `since` of the log. */
export function exprsSince(sent: string[], since: number, grouping: string): string[] {
  return sent.slice(since).filter((expr) => groupingOf(expr) === grouping);
}

/** Imports the fixture under `uid` so spec files running in parallel workers do not share (and delete) one dashboard. */
export async function importBiDashboard(request: APIRequestContext, uid: string): Promise<string> {
  const response = await request.post('/api/dashboards/import', {
    data: { dashboard: { ...testDashboard, uid }, folderUid: '', overwrite: true, inputs: [] },
  });
  return (await response.json()).uid;
}

export async function deleteBiDashboard(request: APIRequestContext, uid: string | undefined) {
  if (uid) {
    await request.delete(`/api/dashboards/uid/${uid}`);
  }
}

/** Hover the bar for `categories[index]`, check the tooltip names it, then click it. */
export async function clickBar(
  page: Page,
  panel: Locator,
  categories: string[],
  index: number,
  modifiers: Array<'ControlOrMeta' | 'Alt'> = []
) {
  const over = panel.locator('.u-over');
  await expect(over, 'plot overlay is rendered').toBeVisible();
  const box = await over.boundingBox();
  if (!box) {
    throw new Error('u-over bounding box not found');
  }
  // An estimate of the bar's centre from equal category slots; the renderer's spacing differs slightly, so the
  // hovered category is checked in the tooltip before clicking.
  const position = {
    x: Math.round(((index + 0.5) / categories.length) * box.width),
    // Low in the plot so the point is inside the bar for every non-trivial value.
    y: Math.round(box.height * 0.9),
  };
  await over.hover({ position, force: true });
  // Moving between charts can briefly leave the previous chart's tooltip up too, so look for the one naming this bar.
  await expect(
    page.locator('[data-testid="data-testid viz-tooltip-wrapper"]').filter({ hasText: categories[index] }).first(),
    `hovering ${categories[index]}`
  ).toBeVisible();
  await over.click({ position, force: true, modifiers });
}

/** Region and product text of each data row in the Details table. */
export async function detailRows(table: Locator): Promise<string[]> {
  const rows = table.locator('[role="row"]');
  // First row is the header.
  const texts = await rows.allInnerTexts();
  return texts.slice(1).map((t) => t.replace(/\s+/g, ' ').trim());
}
