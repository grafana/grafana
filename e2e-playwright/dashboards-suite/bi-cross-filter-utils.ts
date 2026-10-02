import { type APIRequestContext, type Locator, type Page, expect } from '@playwright/test';

import testDashboard from '../dashboards/BiCrossFilterTest.json';

// Fixture assumptions (see BiCrossFilterTest.json):
// - The CSV has 4 regions x 3 products (12 rows), every region/product pair present, with regions first appearing in
//   the order North, South, East, West and products in the order Widget, Gadget, Gizmo.
// - The group-by transformation keeps first-appearance order, so bar i of n is centred at (i + 0.5) / n of the
//   plot width. Filtering by the other chart's key never removes a category, so n stays constant.
// - Bars are canvas pixels, so clicks are computed from the `.u-over` bounding box. Assertions use the table,
//   the URL and the filter bar instead.
export const REGIONS = ['North', 'South', 'East', 'West'];
export const PRODUCTS = ['Widget', 'Gadget', 'Gizmo'];

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

/** Hover, then click, the centre of bar `index` of `count` in the uPlot inside `panel`. */
export async function clickBar(
  page: Page,
  panel: Locator,
  index: number,
  count: number,
  modifiers: Array<'ControlOrMeta' | 'Alt'> = []
) {
  const over = panel.locator('.u-over');
  await expect(over, 'plot overlay is rendered').toBeVisible();
  const box = await over.boundingBox();
  if (!box) {
    throw new Error('u-over bounding box not found');
  }
  const position = {
    x: Math.round(((index + 0.5) / count) * box.width),
    // Low in the plot so the point is inside the bar for every non-trivial value.
    y: Math.round(box.height * 0.9),
  };
  await over.hover({ position, force: true });
  await over.click({ position, force: true, modifiers });
}

/** Region and product text of each data row in the Details table. */
export async function detailRows(table: Locator): Promise<string[]> {
  const rows = table.locator('[role="row"]');
  // First row is the header.
  const texts = await rows.allInnerTexts();
  return texts.slice(1).map((t) => t.replace(/\s+/g, ' ').trim());
}
