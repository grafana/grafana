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

function getPanelStylesSection(page: Page) {
  return page.getByTestId('data-testid Options group panel-styles');
}

function getPresetCard(page: Page, name: string) {
  return page.getByTestId(`data-testid suggestion-${name}`);
}

async function waitForPanelToLoad(page: Page) {
  await expect(page.getByLabel('Panel loading bar'), 'wait for panel to finish loading').toHaveCount(0, {
    timeout: 30000,
  });
}

test.describe(
  'Panel presets - Visibility & defaults',
  {
    tag: ['@various', '@presets'],
  },
  () => {
    test('Panel styles section should appear with a New badge', async ({ gotoPanelEditPage, page }) => {
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      const panelStylesSection = getPanelStylesSection(page);
      await expect(panelStylesSection, 'panel styles section is visible').toBeVisible({ timeout: 10000 });
      await expect(panelStylesSection, 'panel styles section contains "New" badge').toContainText('New');
    });

    test('Panel styles section should be expanded by default', async ({ gotoPanelEditPage, page }) => {
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });

      const collapseButton = getPanelStylesSection(page).getByRole('button', { name: /Collapse/i });
      await expect(collapseButton, 'collapse button is visible').toBeVisible();
      await expect(collapseButton, 'panel styles section is expanded').toHaveAttribute('aria-expanded', 'true');
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

      await waitForPanelToLoad(page);

      await expect(
        getPanelStylesSection(page),
        'panel styles section should be hidden when there is no data'
      ).toBeHidden();
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
        await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: panel.id });
        await waitForPanelToLoad(page);

        await expect(
          getPanelStylesSection(page),
          `panel styles section should be visible for ${panel.name}`
        ).toBeVisible({ timeout: 10000 });
      });
    }

    for (const panel of PANELS_WITHOUT_PRESETS) {
      test(`Panel styles should not appear for ${panel.name}`, async ({ gotoPanelEditPage, page }) => {
        await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: panel.id });
        await waitForPanelToLoad(page);

        await expect(
          getPanelStylesSection(page),
          `panel styles section should be hidden for ${panel.name}`
        ).toBeHidden();
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

      await waitForPanelToLoad(page);

      await expect(
        getPresetCard(page, 'Single fill'),
        'single-series few-points preset card should be visible'
      ).toBeVisible({ timeout: 10000 });
    });

    test('multiple series with many data points shows multi-series presets', async ({ gotoPanelEditPage, page }) => {
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPresetCard(page, 'Lines with points'), 'multi-series preset card should be visible').toBeVisible({
        timeout: 10000,
      });
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
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });

      const firstPreset = getPresetCard(page, 'Lines with points');
      await expect(firstPreset, 'preset card is visible before clicking').toBeVisible();
      await firstPreset.click();

      await expect(firstPreset, 'preset card remains visible after clicking').toBeVisible();
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
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible for time series').toBeVisible({
        timeout: 10000,
      });
      const timeseriesPreset = getPresetCard(page, 'Lines with points');
      await expect(timeseriesPreset, 'time series preset is visible').toBeVisible();

      await panelEditPage.setVisualization('Gauge');
      await expect(page.getByLabel('Panel loading bar'), 'wait for gauge panel to load').toHaveCount(0, {
        timeout: 10000,
      });

      await expect(getPanelStylesSection(page), 'panel styles section is visible for gauge').toBeVisible({
        timeout: 10000,
      });
      const gaugePreset = getPresetCard(page, 'Standard');
      await expect(gaugePreset, 'gauge preset card is visible').toBeVisible({ timeout: 10000 });
      await expect(timeseriesPreset, 'time series preset is hidden after switching to gauge').toBeHidden();
    });

    test('switching to a viz type without presets should hide Panel styles', async ({ gotoPanelEditPage, page }) => {
      const panelEditPage = await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible for time series').toBeVisible({
        timeout: 10000,
      });

      await panelEditPage.setVisualization('Table');
      await expect(page.getByLabel('Panel loading bar'), 'wait for table panel to load').toHaveCount(0, {
        timeout: 10000,
      });

      await expect(getPanelStylesSection(page), 'panel styles section should be hidden for table').toBeHidden();
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
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });
      const preset = getPresetCard(page, 'Lines with points');
      await preset.click();

      await expect(
        panelEditPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.discardChangesButton),
        'discard changes button should be enabled after applying a preset'
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
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });

      const firstPreset = getPresetCard(page, 'Lines with points');
      await firstPreset.focus();
      await expect(firstPreset, 'preset card is focused').toBeFocused();
      await page.keyboard.press('Enter');

      await expect(firstPreset, 'preset card is still visible after Enter').toBeVisible();
    });

    test('preset cards should be activatable with Space', async ({ gotoPanelEditPage, page }) => {
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });

      const firstPreset = getPresetCard(page, 'Lines with points');
      await firstPreset.focus();
      await page.keyboard.press('Space');

      await expect(firstPreset, 'preset card is still visible after Space').toBeVisible();
    });
  }
);

test.describe(
  'Panel presets - @a11y',
  {
    tag: ['@various', '@presets', '@a11y'],
  },
  () => {
    test('basic case should have no a11y violations', async ({
      gotoPanelEditPage,
      scanForA11yViolations,
      page,
      selectors,
    }) => {
      await gotoPanelEditPage({ dashboard: { uid: DASHBOARD_UID }, id: '2' });
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });

      const results = await scanForA11yViolations({
        include: `[data-testid="${selectors.components.OptionsGroup.group('panel-styles')}"]`,
      });
      expect(results, 'presets section should have no a11y violations').toHaveNoA11yViolations();
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
      await waitForPanelToLoad(page);

      await expect(getPanelStylesSection(page), 'panel styles section is visible').toBeVisible({ timeout: 10000 });
      await expect(
        getPresetCard(page, 'Lines with points'),
        'multi-series preset is visible with seriesCount=4'
      ).toBeVisible();

      const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
      await queryEditorRow.getByRole('spinbutton', { name: 'Series count' }).fill('1');

      await waitForPanelToLoad(page);

      await expect(
        getPresetCard(page, 'Line fill'),
        'single-series preset should appear after changing to 1 series'
      ).toBeVisible({ timeout: 10000 });
      await expect(
        getPresetCard(page, 'Lines with points'),
        'multi-series preset should be hidden after changing to 1 series'
      ).toBeHidden();
    });
  }
);
