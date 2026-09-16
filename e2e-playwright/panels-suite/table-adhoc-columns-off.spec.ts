import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

const DASHBOARD_UID = 'table-adhoc-columns';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': false } },
  viewport: { width: 1600, height: 1000 },
});

test.describe('Panels test: Table - ad-hoc columns off', { tag: ['@panels', '@table'] }, () => {
  test('omits column controls when the feature is disabled', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Ad-hoc columns'));

    await waitForTableLoad(panel);
    expect(await panel.locator('[role="columnheader"] button[title]').allTextContents()).toEqual([
      'region',
      'host',
      'cpu',
      'mem',
    ]);

    await expect(
      panel.getByTestId(selectors.components.Panels.Visualization.TableNG.headerColumnMenu.button)
    ).toBeHidden();

    for (const header of await panel.locator('[role="columnheader"]').all()) {
      await expect(header).not.toHaveAttribute('draggable', 'true');
    }
  });
});
