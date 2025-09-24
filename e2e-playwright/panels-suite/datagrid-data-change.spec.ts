import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_ID = 'c01bf42b-b783-4447-a304-8554cee1843b';
const DATAGRID_SELECT_SERIES = 'Datagrid Select series';

test.use({
  featureToggles: {
    enableDatagridEditing: true,
  },
});

// TODO enable this test when panel goes live
test.describe.skip(
  'Datagrid data changes',
  {
    tag: ['@panels'],
  },
  () => {
    test('Tests changing data in the grid', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DASHBOARD_ID,
        queryParams: new URLSearchParams({ editPanel: '1' }),
      });

      // Check that the data is series A
      await expect(
        dashboardPage.getByGrafanaSelector(
          selectors.components.PanelEditor.OptionsPane.fieldLabel(DATAGRID_SELECT_SERIES)
        )
      ).toBeVisible();
      await expect(page.getByTestId('glide-cell-2-0')).toHaveText('1');
      await expect(page.getByTestId('glide-cell-2-1')).toHaveText('20');
      await expect(page.getByTestId('glide-cell-2-2')).toHaveText('90');

      // Change the series to B
      const seriesInput = dashboardPage
        .getByGrafanaSelector(selectors.components.PanelEditor.OptionsPane.fieldLabel(DATAGRID_SELECT_SERIES))
        .locator('input');
      await seriesInput.fill('B');
      await seriesInput.press('Enter');
      await expect(page.getByTestId('glide-cell-2-3')).toHaveText('30');
      await expect(page.getByTestId('glide-cell-2-4')).toHaveText('40');
      await expect(page.getByTestId('glide-cell-2-5')).toHaveText('50');

      // Edit datagrid which triggers a snapshot query
      await page.locator('.dvn-scroller').click({ position: { x: 200, y: 100 } });
      await expect(page.getByTestId('glide-cell-2-1')).toHaveAttribute('aria-selected', 'true');
      await page.keyboard.type('12');
      await page.keyboard.press('Enter');

      await page.getByTestId('data-testid Confirm Modal Danger Button').click();

      await expect(page.getByTestId('query-editor-row')).toContainText('Snapshot');
    });
  }
);
