import { type Page } from '@playwright/test';

import { test, expect, type E2ESelectorGroups } from '@grafana/plugin-e2e';

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

// The "+" add buttons in the sidebar section headers are wrapped in a div[role="button"]
// (SidebarCollapsableHeader) with stopPropagation. getByRole('button') matches the wrapper
// first and swallows the click, so we target the actual <button> element directly.
function addQueryOrExpressionButton(page: Page) {
  return page.locator('button[aria-label="Add query or expression"]');
}

function addTransformationButton(page: Page) {
  return page.locator('button[aria-label="Add transformation"]');
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
    await cardB.getByRole('button', { name: 'Remove Query' }).click({ force: true });

    await expect(cardB).toBeHidden();
    await expect(page.locator('[data-query-sidebar-card="A"]')).toBeVisible();
  });

  test('can hide and show a query', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const cardA = page.locator('[data-query-sidebar-card="A"]');
    await cardA.hover();
    await cardA.getByRole('button', { name: 'Hide Query' }).click({ force: true });

    const hiddenIndicator = cardA.locator('[data-testid="icon-eye-slash"]').first();
    await expect(hiddenIndicator).toBeVisible();

    await cardA.hover();
    await cardA.getByRole('button', { name: 'Show Query' }).click({ force: true });
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
  test('content area loads the correct datasource query editor', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const scenarioSelect = dashboardPage.getByGrafanaSelector(
      selectors.components.DataSource.TestData.QueryTab.scenarioSelectContainer
    );
    await expect(scenarioSelect.first()).toBeVisible();
  });

  test('expression queries are preserved when adding an expression', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();
    await page.getByRole('button', { name: 'Math', exact: true }).click();

    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Transformations
// ---------------------------------------------------------------------------
test.describe('Query Editor Next: Transformations', { tag: ['@panels', '@queryEditorNext'] }, () => {
  async function openTransformationPicker(page: Page, selectors: E2ESelectorGroups) {
    await addTransformationButton(page).click();

    // When no transformations exist, the empty state shows first — click through to the full picker
    const showPickerButton = page.getByTestId(selectors.components.Transforms.addTransformationButton);
    await showPickerButton.click();

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
    await transformCard.getByRole('button', { name: 'Remove Transformation' }).click({ force: true });

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

  test('can add a Threshold expression', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();
    await page.getByRole('button', { name: 'Threshold', exact: true }).click();

    await expect(page.locator('[data-query-sidebar-card="B"]')).toBeVisible();
  });

  test('SQL expression type is available with sqlExpressions toggle', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await addQueryOrExpressionButton(page).click();
    await page.getByRole('menuitem', { name: 'Add expression' }).click();

    await expect(page.getByRole('button', { name: 'SQL', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'SQL', exact: true }).click();

    await expect(page.locator('.monaco-editor').first()).toBeVisible({ timeout: 15_000 });
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
