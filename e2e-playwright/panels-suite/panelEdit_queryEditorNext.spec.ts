import { type Page } from '@playwright/test';

import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

test.use({
  featureToggles: {
    sqlExpressions: true,
  },
  // queryEditorNext uses OpenFeature (OFREP), not legacy config.featureToggles
  openFeature: {
    flags: {
      queryEditorNext: true,
    },
  },
});

const DASHBOARD_UID = '5SdHCadmz';
const PANEL_ID = '3';

function editPanelUrl() {
  return new URLSearchParams({ editPanel: PANEL_ID });
}

function addQueryOrExpressionButton(page: Page) {
  return page.getByLabel('Add query or expression');
}

function addTransformationButton(page: Page) {
  return page.getByLabel('Add transformation');
}

// ---------------------------------------------------------------------------
// Layout & Navigation
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Layout & Navigation', { tag: ['@panels', '@queryEditorNext'] }, () => {
  test('renders the new editor layout with sidebar instead of classic tabs', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();

    const viewToggle = page.getByRole('radiogroup', { name: 'View' });
    await expect(viewToggle).toBeVisible();
    await expect(viewToggle.getByRole('radio', { name: 'Data' })).toBeVisible();
    await expect(viewToggle.getByRole('radio', { name: /Alerts/ })).toBeVisible();

    await expect(page.getByRole('tab', { name: /Queries/i })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: /Transformations/i })).toHaveCount(0);

    await expect(page.getByText('Queries & Expressions')).toBeVisible();
    await expect(page.getByText('Transformations')).toBeVisible();
    await expect(page.getByRole('button', { name: /Query Options/i })).toBeVisible();
  });

  test('sidebar can toggle between mini and full size', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const toggleButton = page.getByRole('button', { name: 'Toggle sidebar size' });
    await expect(toggleButton).toBeVisible();

    const viewToggle = page.getByRole('radiogroup', { name: 'View' });
    await expect(viewToggle).toBeVisible();

    await toggleButton.click();
    await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();

    await toggleButton.click();
    await expect(viewToggle).toBeVisible();
  });

  test('can toggle between Data and Alerts views', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await expect(page.getByText('Queries & Expressions')).toBeVisible();

    const viewToggle = page.getByRole('radiogroup', { name: 'View' });
    await viewToggle.getByRole('radio', { name: /Alerts/ }).click();
    await expect(page.getByText('Queries & Expressions')).toBeHidden();

    await viewToggle.getByRole('radio', { name: 'Data' }).click();
    await expect(page.getByText('Queries & Expressions')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Sidebar Query Management
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Sidebar Query Management', { tag: ['@panels', '@queryEditorNext'] }, () => {
  test('initial query card is visible and selected', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const cardA = page.locator('[data-query-sidebar-card="A"]');
    await expect(cardA).toBeVisible();
    await expect(cardA).toHaveAttribute('aria-pressed', 'true');
  });

  test('can add a new query via the sidebar', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add query' }).click();

    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();
  });

  test('can select different queries by clicking sidebar cards', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add query' }).click();

    const cardA = page.locator('[data-query-sidebar-card="A"]');
    const cardB = page.locator('[data-query-sidebar-card="B"]');

    await cardA.click();
    await expect(cardA).toHaveAttribute('aria-pressed', 'true');
    await expect(cardB).toHaveAttribute('aria-pressed', 'false');

    await cardB.click();
    await expect(cardB).toHaveAttribute('aria-pressed', 'true');
    await expect(cardA).toHaveAttribute('aria-pressed', 'false');
  });

  test('can delete a query from the sidebar', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add query' }).click();

    const cardB = page.locator('[data-query-sidebar-card="B"]');
    await expect(cardB).toBeVisible();

    await cardB.click();
    await cardB.hover();
    const removeQueryButton = cardB.getByRole('button', { name: 'Remove Query' });
    await expect(removeQueryButton).toBeVisible();
    await removeQueryButton.click();

    await expect(cardB).toBeHidden();
    await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();
  });

  test('can hide and show a query', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const cardA = page.locator('[data-query-sidebar-card="A"]');
    await cardA.hover();
    const hideQueryButton = cardA.getByRole('button', { name: 'Hide Query' });
    await expect(hideQueryButton).toBeVisible();
    await hideQueryButton.click();

    const hiddenIndicator = cardA.locator('[data-testid="icon-eye-slash"]').first();
    await expect(hiddenIndicator).toBeVisible();

    await cardA.hover();
    const showQueryButton = cardA.getByRole('button', { name: 'Show Query' });
    await expect(showQueryButton).toBeVisible();
    await showQueryButton.click();
    await expect(hiddenIndicator).toBeHidden();
  });

  test('can rename a query via the content header', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await page.getByRole('button', { name: 'Edit query name' }).click();

    const nameInput = page.getByTestId('query-name-input');
    await expect(nameInput).toBeVisible();

    await nameInput.fill('MyQuery');
    await nameInput.press('Enter');

    await expect(page.locator('[data-query-sidebar-card="MyQuery"]')).toBeVisible();
    await expect(page.locator('[data-query-sidebar-card="A"]')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// Datasource Switching
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Datasource Switching', { tag: ['@panels', '@queryEditorNext'] }, () => {
  async function switchDatasource(
    dashboardPage: DashboardPage,
    page: Page,
    selectors: E2ESelectorGroups,
    datasourceName: string
  ) {
    // Datasource picker is only rendered for datasource-backed query cards (not expressions).
    const queryACard = page.locator('[data-query-sidebar-card="A"]').first();
    if ((await queryACard.count()) > 0) {
      await queryACard.click();
      await expect(queryACard).toHaveAttribute('aria-pressed', 'true');
    }

    const dataSourceInput = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.inputV2);
    await expect(dataSourceInput).toBeVisible();
    await dataSourceInput.fill(datasourceName);

    const dataSourceList = dashboardPage.getByGrafanaSelector(selectors.components.DataSourcePicker.dataSourceList);
    await expect(dataSourceList).toBeVisible();
    await dataSourceList.getByText(datasourceName).first().click();
  }

  async function ensureTestDataDatasource(dashboardPage: DashboardPage, page: Page, selectors: E2ESelectorGroups) {
    const testDataScenarioSelect = page.getByRole('combobox', { name: 'Scenario' });
    if ((await testDataScenarioSelect.count()) === 0) {
      await switchDatasource(dashboardPage, page, selectors, 'gdev-testdata');
    }
    await expect(testDataScenarioSelect.first()).toBeVisible();
    return testDataScenarioSelect;
  }

  test('switching datasource updates query editor content', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const testDataScenarioSelect = await ensureTestDataDatasource(dashboardPage, page, selectors);

    await switchDatasource(dashboardPage, page, selectors, 'gdev-prometheus');

    await expect(testDataScenarioSelect).toBeHidden();
    await expect(
      page.getByTestId(selectors.components.DataSource.Prometheus.queryEditor.builder.metricSelect)
    ).toBeVisible();
  });

  test('queries and expressions survive datasource switching', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });
    await ensureTestDataDatasource(dashboardPage, page, selectors);

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();
    await page.getByRole('button', { name: 'Math', exact: true }).click();

    await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();
    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();

    await switchDatasource(dashboardPage, page, selectors, 'gdev-prometheus');
    await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();
    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();

    await switchDatasource(dashboardPage, page, selectors, 'gdev-testdata');
    await expect(page.getByRole('combobox', { name: 'Scenario' })).toBeVisible();
    await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();
    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Transformations', { tag: ['@panels', '@queryEditorNext'] }, () => {
  async function openTransformationPicker(page: Page, selectors: E2ESelectorGroups) {
    await addTransformationButton(page).click();

    const searchInput = page.getByTestId(selectors.components.Transforms.searchInput);
    await expect(searchInput).toBeVisible();
    return searchInput;
  }

  test('can add a transformation via the sidebar', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const searchInput = await openTransformationPicker(page, selectors);
    await searchInput.fill('Reduce');
    await page.getByTestId(selectors.components.TransformTab.newTransform('Reduce')).click();

    await expect(page.getByTestId(selectors.components.TransformTab.transformationEditor('Reduce'))).toBeVisible();
  });

  test('selecting a transformation card renders its editor', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const searchInput = await openTransformationPicker(page, selectors);
    await searchInput.fill('Reduce');
    await page.getByTestId(selectors.components.TransformTab.newTransform('Reduce')).click();

    // Switch away and back to prove card selection drives editor state.
    await page.locator('[data-query-sidebar-card="A"]').click();
    const reduceCard = page.locator('[data-query-sidebar-card]').filter({ hasText: 'Reduce' }).first();
    await reduceCard.click();
    await expect(reduceCard).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId(selectors.components.TransformTab.transformationEditor('Reduce'))).toBeVisible();
  });

  test('can delete a transformation from the sidebar', async ({ gotoDashboardPage, selectors, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const searchInput = await openTransformationPicker(page, selectors);
    await searchInput.fill('Reduce');
    await page.getByTestId(selectors.components.TransformTab.newTransform('Reduce')).click();

    await expect(page.getByTestId(selectors.components.TransformTab.transformationEditor('Reduce'))).toBeVisible();

    const transformCard = page.locator('[data-query-sidebar-card]').filter({ hasText: 'Reduce' });
    await transformCard.hover();
    const removeTransformationButton = transformCard.getByRole('button', { name: 'Remove Transformation' });
    await expect(removeTransformationButton).toBeVisible();
    await removeTransformationButton.click();

    // Transformations require delete confirmation
    await page.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByTestId(selectors.components.TransformTab.transformationEditor('Reduce'))).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Expression Flows
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Expression Flows', { tag: ['@panels', '@queryEditorNext'] }, () => {
  test('expression type picker shows all types', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();

    // Card.Heading renders as a <button>, not an <h*> element
    await expect(page.getByRole('button', { name: 'Math', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reduce', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Resample', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Threshold', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Math', exact: true }).click();
    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();
  });

  test('can add a Reduce expression and see its editor', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();
    await page.getByRole('button', { name: 'Reduce', exact: true }).click();

    await expect(page.getByText('Function', { exact: true })).toBeVisible();
  });

  test('SQL expression type is available with sqlExpressions toggle', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();

    await expect(page.getByRole('button', { name: 'SQL', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'SQL', exact: true }).click();

    await expect(page.getByTestId('sql-expression-editor')).toBeVisible({ timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// Query Options
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Query Options', { tag: ['@panels', '@queryEditorNext'] }, () => {
  test('can open the query options sidebar from the footer', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await page.getByRole('button', { name: /Query Options/i }).click();

    await expect(page.getByRole('spinbutton', { name: 'Max data points' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Min interval' })).toBeVisible();
  });

  test('can edit max data points', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await page.getByRole('button', { name: /Edit Max data points/i }).click();

    const maxDataPointsInput = page.getByRole('spinbutton', { name: 'Max data points' });
    await expect(maxDataPointsInput).toBeVisible();

    await maxDataPointsInput.fill('500');
    await maxDataPointsInput.press('Tab');

    await expect(page.getByRole('button', { name: /Edit Max data points/i })).toContainText('500');
  });

  test('can set relative time override', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await page.getByRole('button', { name: /Edit Relative time/i }).click();

    const relativeTimeInput = page.getByRole('textbox', { name: 'Relative time' });
    await expect(relativeTimeInput).toBeVisible();

    await relativeTimeInput.fill('1h');
    await relativeTimeInput.press('Tab');

    await expect(page.getByRole('button', { name: /Edit Relative time/i })).toContainText('1h');
  });

  test('clicking outside closes the query options sidebar', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await page.getByRole('button', { name: /Query Options/i }).click();
    const maxDataPointsInput = page.getByRole('spinbutton', { name: 'Max data points' });
    await expect(maxDataPointsInput).toBeVisible();

    await page.getByTestId('viz-resizer').click({ force: true });
    await expect(maxDataPointsInput).toBeHidden();
  });
});
