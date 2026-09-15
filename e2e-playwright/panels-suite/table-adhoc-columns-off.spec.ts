import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'table-adhoc-columns';

// The refreshed header without the new column interactions: the column menu is back to being about
// filtering only, and nothing is draggable. Its own file because `openFeature` forces a new worker,
// so Playwright will not take it in a describe group.
test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': false } },
  viewport: { width: 1600, height: 1000 },
});

test.describe('Panels test: Table - ad-hoc columns off', { tag: ['@panels', '@table'] }, () => {
  test('offers no column menu and makes no column draggable', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    expect(await panel.locator('[role="columnheader"] button[title]').allTextContents()).toEqual([
      'region',
      'host',
      'cpu',
      'mem',
    ]);

    // No column opts into filtering, hiding or reordering, and the flag that would opt them all in
    // is off, so there is nothing to put in a column menu.
    await expect(
      panel.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button)
    ).toBeHidden();

    for (const header of await panel.locator('[role="columnheader"]').all()) {
      await expect(header).not.toHaveAttribute('draggable', 'true');
    }
  });
});
