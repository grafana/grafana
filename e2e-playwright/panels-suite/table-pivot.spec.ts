import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1800, height: 1100 },
});

test(
  'pivots sales with source-aware grand totals and restores the table',
  { tag: ['@panels', '@table', '@a11y'] },
  async ({ gotoDashboardPage, selectors, page, scanForA11yViolations }, testInfo) => {
    test.slow();
    const dashboard = await gotoDashboardPage({ uid: 'table-pivot' });
    const panel = dashboard.getByGrafanaSelector(selectors.components.Panels.Panel.title('Pivot — sales'));
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;
    await waitForTableLoad(panel);
    await panel.getByTestId(sidebar.settingsButton).click();
    await panel
      .getByTestId(sidebar.viewModeRadioGroup)
      .getByRole('radio', { name: 'Pivot', exact: true })
      .click({ force: true });
    const choose = async (selector: string, option: string) => {
      await panel.getByTestId(selector).click();
      await page.getByRole('option', { name: option, exact: true }).click();
    };
    await choose(sidebar.pivot.rowsField, 'Region');
    await choose(sidebar.pivot.columnsField, 'Period');
    await choose(sidebar.pivot.valuesField, 'Revenue');
    await panel.getByRole('combobox', { name: 'Summarize Revenue 1' }).click();
    await page.getByRole('option', { name: /^Mean/ }).click();
    await panel.getByTestId(sidebar.pivot.applyButton).click();
    await expect(panel.getByRole('columnheader')).toHaveCount(4);
    await expect(panel.getByRole('row').nth(1).getByRole('gridcell')).toContainText(['East', '20', '90', '43']);
    const footer = panel.getByTestId(selectors.components.Panels.Visualization.TableNG.Footer.Value);
    await expect(footer).toContainText(['60', '90', '66']);
    await panel.getByTestId(sidebar.settingsButton).click();
    const report = await scanForA11yViolations({
      include: [`[data-testid="${selectors.components.Panels.Panel.title('Pivot — sales')}"]`],
      options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    });
    expect(report).toHaveNoA11yViolations();
    await testInfo.attach('Pivot sales', {
      body: await panel.screenshot({ path: testInfo.outputPath('pivot.png') }),
      contentType: 'image/png',
    });
    await panel
      .getByTestId(sidebar.viewModeRadioGroup)
      .getByRole('radio', { name: 'Table', exact: true })
      .click({ force: true });
    await expect(panel.getByRole('columnheader')).toHaveCount(6);
    await expect(panel.getByRole('row').nth(1).getByRole('gridcell')).toHaveText([
      'East',
      'A',
      'Jan',
      '$10',
      '1',
      'alice',
    ]);
  }
);
