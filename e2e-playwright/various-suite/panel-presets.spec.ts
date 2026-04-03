import { type Page } from '@playwright/test';

import { expect, test } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'n1jR8vnnz';

const PANELS_WITH_PRESETS = [
  { id: '2', name: 'Time series' },
  { id: '16', name: 'Stat' },
  { id: '20', name: 'Bar gauge' },
  { id: '18', name: 'Gauge' },
  { id: '14', name: 'Bar chart' },
];

const PANELS_WITHOUT_PRESETS = [
  { id: '22', name: 'Table' },
  { id: '28', name: 'Logs' },
  { id: '24', name: 'Pie chart' },
];

test.use({
  featureToggles: {
    vizPresets: true,
  },
});

function getPanelStylesHeading(page: Page) {
  return page.getByRole('heading', { name: /Panel styles/i, level: 6 });
}

function getPresetCard(page: Page, name: string) {
  return page.getByTestId(`data-testid suggestion-${name}`);
}

test.describe(
  'Panel presets - Visibility & defaults',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('Panel styles section should appear with a New badge', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      const panelStylesHeading = getPanelStylesHeading(page);
      await expect(panelStylesHeading).toBeVisible({ timeout: 10000 });
      await expect(panelStylesHeading).toContainText('New');
    });

    test('Panel styles section should be expanded by default', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      const collapseButton = page.getByRole('button', { name: /Collapse Panel styles/i });
      await expect(collapseButton).toBeVisible({ timeout: 10000 });
      await expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    });
  }
);

test.describe(
  'Panel presets - Empty / No-data states',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('Panel styles should not render when panel has no data', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });

      const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
      await queryEditorRow.getByLabel('Scenario').last().click();
      await page.getByText('No Data Points', { exact: true }).click();

      await panelEditPage.refreshPanel();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeHidden();
    });
  }
);

test.describe(
  'Panel presets - Panel support',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    for (const panel of PANELS_WITH_PRESETS) {
      test(`Presets should appear for ${panel.name}`, async ({ gotoPanelEditPage, page }) => {
        const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: panel.id });
        await expect(panelEditPage.refreshPanel()).toBeOK();
        await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

        await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });
      });
    }

    for (const panel of PANELS_WITHOUT_PRESETS) {
      test(`Panel styles should not appear for ${panel.name}`, async ({ gotoPanelEditPage, page }) => {
        const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: panel.id });
        await expect(panelEditPage.refreshPanel()).toBeOK();
        await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

        await expect(getPanelStylesHeading(page)).toBeHidden();
      });
    }
  }
);

test.describe(
  'Panel presets - Data-aware presets (Time series)',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('single series with few data points shows single-series few-points presets', async ({
      gotoPanelEditPage,
      page,
    }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });

      const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
      await queryEditorRow.getByLabel('Scenario').last().click();
      await page.getByText('CSV Metric Values', { exact: true }).click();

      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPresetCard(page, 'Single fill')).toBeVisible({ timeout: 10000 });
    });

    test('multiple series with many data points shows multi-series presets', async ({ gotoPanelEditPage, page }) => {
      // The timeseries panel already has seriesCount=4, so multi-series presets should appear
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPresetCard(page, 'Lines with points')).toBeVisible({ timeout: 10000 });
    });
  }
);

test.describe(
  'Panel presets - Applying a preset',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('clicking a preset card should apply the style', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });

      const firstPreset = getPresetCard(page, 'Lines with points');
      await expect(firstPreset).toBeVisible();
      await firstPreset.click();

      await expect(firstPreset).toBeVisible();
    });
  }
);

test.describe(
  'Panel presets - Switching visualization type',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('changing viz type should update presets for the new plugin', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });
      const timeseriesPreset = getPresetCard(page, 'Lines with points');
      await expect(timeseriesPreset).toBeVisible();

      await panelEditPage.setVisualization('Gauge');
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });
      const gaugePreset = getPresetCard(page, 'Standard');
      await expect(gaugePreset).toBeVisible({ timeout: 10000 });

      await expect(timeseriesPreset).toBeHidden();
    });

    test('switching to a viz type without presets should hide Panel styles', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });

      await panelEditPage.setVisualization('Table');
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeHidden();
    });
  }
);

test.describe(
  'Panel presets - Save flow',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('applying a preset should mark the dashboard as dirty', async ({ gotoPanelEditPage, selectors, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });
      const preset = getPresetCard(page, 'Lines with points');
      await preset.click();

      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton)
      ).toBeEnabled();
    });
  }
);

test.describe(
  'Panel presets - Keyboard accessibility',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('preset cards should be focusable via Tab and activatable with Enter', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });

      const firstPreset = getPresetCard(page, 'Lines with points');
      await firstPreset.focus();
      await expect(firstPreset).toBeFocused();
      await page.keyboard.press('Enter');

      await expect(firstPreset).toBeVisible();
    });

    test('preset cards should be activatable with Space', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });

      const firstPreset = getPresetCard(page, 'Lines with points');
      await firstPreset.focus();
      await page.keyboard.press('Space');

      await expect(firstPreset).toBeVisible();
    });
  }
);

test.describe(
  'Panel presets - Cross-flow scenarios',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('changing data shape should show different presets', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      // Panel has seriesCount=4, so multi-series presets should appear
      await expect(getPanelStylesHeading(page)).toBeVisible({ timeout: 10000 });
      await expect(getPresetCard(page, 'Lines with points')).toBeVisible();

      // Change to 1 series to get single-series presets
      const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
      await queryEditorRow.getByRole('spinbutton', { name: 'Series count' }).fill('1');

      await expect(panelEditPage.refreshPanel()).toBeOK();
      await expect(page.getByLabel('Panel loading bar')).toHaveCount(0, { timeout: 10000 });

      // Single-series presets should now appear
      await expect(getPresetCard(page, 'Line fill')).toBeVisible({ timeout: 10000 });
      await expect(getPresetCard(page, 'Lines with points')).toBeHidden();
    });
  }
);
