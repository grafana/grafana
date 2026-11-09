import { type APIRequestContext } from '@playwright/test';

import { test, expect } from '@grafana/plugin-e2e';

// The `namespace` fixture is per-test and cannot be used in afterAll - hardcoded to match
// custom.ini's stack_id, the same way the dashboard-restore specs do.
const NAMESPACE = 'stacks-12345';
const NOTEBOOKS_API = `/apis/dashboard.grafana.app/v2beta1/namespaces/${NAMESPACE}/notebooks`;

const SUFFIX = Date.now().toString(36);

/** Pulls the uid out of the success toast's "View notebook" link, whatever query string it carries. */
function extractNotebookUid(href: string | null): string | undefined {
  return href?.match(/\/notebooks\/([^/?]+)/)?.[1];
}

/**
 * The toast + link only prove the modal reported success, not that the panel itself survived the
 * write - a regression that silently dropped it would still show the same toast. Fetches the
 * notebook back from the API and asserts it actually persisted exactly one real panel element
 * with at least one query, rather than an empty or missing one.
 */
async function expectPersistedPanel(request: APIRequestContext, uid: string): Promise<void> {
  const response = await request.get(`${NOTEBOOKS_API}/${uid}`);
  expect(response.ok()).toBeTruthy();
  const spec = (await response.json()).spec;
  const elements = Object.values(spec.elements ?? {}) as Array<{
    kind: string;
    spec?: { data?: { spec?: { queries?: unknown[] } } };
  }>;

  const panels = elements.filter((element) => element.kind === 'Panel');
  expect(panels).toHaveLength(1);
  expect(panels[0].spec?.data?.spec?.queries?.length ?? 0).toBeGreaterThan(0);
}

test.describe('Add panel to notebook from Explore', () => {
  let createdUid: string | undefined;

  test.afterAll(async ({ request }) => {
    if (createdUid) {
      await request.delete(`${NOTEBOOKS_API}/${createdUid}`);
    }
  });

  test('runs a query in Explore and adds the panel to a new notebook', async ({
    page,
    dashboardPage,
    selectors,
    request,
  }) => {
    const notebookTitle = `E2E Notebook From Explore ${SUFFIX}`;

    await page.goto('/explore');

    const scenarioSelectContainer = dashboardPage.getByGrafanaSelector(
      selectors.components.DataSource.TestData.QueryTab.scenarioSelectContainer
    );
    await expect(scenarioSelectContainer).toBeVisible();
    await scenarioSelectContainer.locator('input[id*="test-data-scenario-select-"]').click();
    await page.getByText('CSV Metric Values').click();
    await dashboardPage.getByGrafanaSelector(selectors.components.RefreshPicker.runButtonV2).click();

    // With notebooks enabled there's more than one "Add to X" extension, so this is a dropdown
    // rather than a single standalone button.
    await page.getByTestId(selectors.pages.Explore.toolbar.addTo).click();
    await page.getByTestId(selectors.pages.Explore.toolbar.add('Add to notebook')).click();

    // "New notebook" is the modal's default tab.
    await page.getByRole('textbox', { name: /Notebook name/ }).fill(notebookTitle);
    await page.getByRole('button', { name: 'Add to notebook', exact: true }).click();

    // Success closes the modal and leaves a toast with a link, rather than navigating away.
    const viewLink = page.getByRole('link', { name: 'View notebook' });
    await expect(viewLink).toBeVisible();
    createdUid = extractNotebookUid(await viewLink.getAttribute('href'));
    expect(createdUid).toBeTruthy();

    await expectPersistedPanel(request, createdUid!);
  });
});

test.describe('Add panel to notebook from a dashboard panel', () => {
  let createdUid: string | undefined;

  test.afterAll(async ({ request }) => {
    if (createdUid) {
      await request.delete(`${NOTEBOOKS_API}/${createdUid}`);
    }
  });

  test('adds a panel from the panel menu without needing dashboard edit mode', async ({
    gotoDashboardPage,
    page,
    selectors,
    request,
  }) => {
    const notebookTitle = `E2E Notebook From Dashboard ${SUFFIX}`;

    // Left in view mode deliberately: "Add to notebook" writes to the notebook, not the
    // dashboard, so it's not gated on edit mode - this is the regression that gate would catch.
    // A real timeseries panel with actual queries, not a text panel - every panel on the "tall
    // dashboard" fixture other specs use for panel-menu tests is a text panel, which is a poor
    // target for asserting a query survived the add-to-notebook round trip.
    const dashboardPage = await gotoDashboardPage({ uid: 'gdev-view-panel-tests' });

    const panelTitle = 'Time series panel';
    const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(panelTitle));
    await panel.hover();
    await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menu(panelTitle)).click();
    await dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.menuItems('Add to notebook')).click();

    await page.getByRole('textbox', { name: /Notebook name/ }).fill(notebookTitle);
    await page.getByRole('button', { name: 'Add to notebook', exact: true }).click();

    const viewLink = page.getByRole('link', { name: 'View notebook' });
    await expect(viewLink).toBeVisible();
    createdUid = extractNotebookUid(await viewLink.getAttribute('href'));
    expect(createdUid).toBeTruthy();

    await expectPersistedPanel(request, createdUid!);
  });
});
