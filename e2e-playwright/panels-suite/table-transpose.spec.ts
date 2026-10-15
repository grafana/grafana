import { test, expect } from '@grafana/plugin-e2e';

import { waitForTableLoad } from './table-utils';

test.use({
  openFeature: { flags: { 'table.refresh': true, 'table.refreshNewFeatures': true } },
  viewport: { width: 1800, height: 1100 },
});

test(
  'transposes with row overrides, compares column fields, and restores the table',
  { tag: ['@panels', '@table', '@a11y'] },
  async ({ gotoDashboardPage, selectors, page, scanForA11yViolations }, testInfo) => {
    const dashboard = await gotoDashboardPage({ uid: 'table-transpose' });
    const panel = dashboard.getByGrafanaSelector(
      selectors.components.Panels.Panel.title('Transpose — field overrides')
    );
    const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;
    const a11yContext = {
      include: [`[data-testid="${selectors.components.Panels.Panel.title('Transpose — field overrides')}"]`],
      options: { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] },
    };
    await waitForTableLoad(panel);
    await expect(panel.getByText('Healthy', { exact: true })).toHaveCount(5);
    const original = await panel.getByRole('gridcell').allTextContents();
    await expect(panel.getByTestId(sidebar.settingsButton)).toHaveAttribute('aria-expanded', 'false');
    await expect(
      panel.getByTestId(sidebar.viewModeRadioGroup).getByRole('radio', { name: 'Transpose', exact: true })
    ).toBeHidden();
    await panel.getByTestId(sidebar.settingsButton).click();
    await expect(panel.getByTestId(sidebar.fieldSettingsRadioGroup)).toHaveCount(0);
    await panel
      .getByTestId(sidebar.viewModeRadioGroup)
      .getByRole('radio', { name: 'Transpose', exact: true })
      .click({ force: true });
    await expect(panel.getByRole('row').first().getByRole('gridcell')).toHaveText([
      'Host',
      'alpha',
      'bravo',
      'charlie',
      'delta',
      'echo',
    ]);
    await expect(panel.getByRole('row').nth(1).getByRole('gridcell')).toHaveText([
      'Load',
      '20%',
      '40%',
      '60%',
      '80%',
      '100%',
    ]);
    await expect(panel.getByText('Healthy', { exact: true })).toHaveCount(5);
    await expect(panel.getByRole('checkbox', { name: 'Hide Load' })).toBeDisabled();
    await expect(panel.getByRole('button', { name: 'Sort', exact: true })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Manage columns', exact: true })).toHaveCount(0);
    await expect(
      panel.getByText(
        'Turn off Transpose to change filters, sorting, or field layout. Apply filters before transposing.'
      )
    ).toBeVisible();
    await expect(panel.getByRole('row').first()).toMatchAriaSnapshot(`
    - row:
      - gridcell "Host"
      - gridcell "alpha"
      - gridcell "bravo"
      - gridcell "charlie"
      - gridcell "delta"
      - gridcell "echo"
  `);
    expect(await scanForA11yViolations(a11yContext)).toHaveNoA11yViolations();
    await testInfo.attach('Transpose rows', {
      body: await panel.screenshot({ path: testInfo.outputPath('transpose-rows.png') }),
      contentType: 'image/png',
    });
    await panel.getByTestId(sidebar.closeButton).click();
    await panel.getByTestId(sidebar.transposeManageButton).click();
    await expect(
      panel.getByTestId(sidebar.viewModeRadioGroup).getByRole('radio', { name: 'Transpose', exact: true })
    ).toBeHidden();
    await panel.getByTestId(sidebar.settingsButton).click();
    await expect(
      panel.getByTestId(sidebar.viewModeRadioGroup).getByRole('radio', { name: 'Transpose', exact: true })
    ).toBeChecked();
    await panel
      .getByTestId(sidebar.fieldSettingsRadioGroup)
      .getByRole('radio', { name: 'Columns', exact: true })
      .click({ force: true });
    await expect(panel.getByRole('columnheader')).toHaveCount(6);
    await panel.getByTestId(sidebar.settingsButton).click();
    await expect(panel.getByRole('checkbox', { name: 'Hide alpha' })).toBeEnabled();
    await panel.getByRole('button', { name: 'Field', exact: true }).click();
    await expect(panel.getByRole('row').nth(1).getByRole('gridcell').first()).toHaveText('Details');
    await panel.getByRole('button', { name: 'Field', exact: true }).click();
    await panel.getByRole('button', { name: 'Field', exact: true }).click();
    await expect(panel.getByText('Healthy', { exact: true })).toHaveCount(0);
    await expect(panel.getByRole('row').nth(1).getByRole('gridcell')).toHaveText([
      'Load',
      '20',
      '40',
      '60',
      '80',
      '100',
    ]);
    await expect(
      panel.getByText('Transposing creates new fields. Existing field overrides may no longer match.')
    ).toHaveCount(0);
    const report = await scanForA11yViolations(a11yContext);
    expect(report).toHaveNoA11yViolations();
    await testInfo.attach('Transpose columns', {
      body: await panel.screenshot({ path: testInfo.outputPath('transpose-columns.png') }),
      contentType: 'image/png',
    });
    await panel
      .getByTestId(sidebar.viewModeRadioGroup)
      .getByRole('radio', { name: 'Table', exact: true })
      .click({ force: true });
    await expect(panel.getByTestId(sidebar.fieldSettingsRadioGroup)).toHaveCount(0);
    await expect(panel.getByRole('gridcell')).toHaveText(original);
    await expect(panel.getByRole('checkbox', { name: 'Hide Load' })).toBeEnabled();
    await page.reload();
    await waitForTableLoad(panel);
    await panel.getByTestId(sidebar.settingsButton).click();
    await expect(
      panel.getByTestId(sidebar.viewModeRadioGroup).getByRole('radio', { name: 'Table', exact: true })
    ).toBeChecked();
  }
);
