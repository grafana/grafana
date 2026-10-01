import { test, expect } from '@grafana/plugin-e2e';

// Panel edit no longer renders the app nav toolbar — its actions (Back / Discard, and the library
// panel actions) live in the dashboard controls row. queryEditorNext gives us the PanelEditNext
// renderer, which is where the layout regression below was originally seen.
test.use({
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

test.describe('Panel edit: toolbar actions', { tag: ['@panels'] }, () => {
  test('renders Back and Discard in the controls row', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    await expect(dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content)).toBeVisible();
    await expect(dashboardPage.getByGrafanaSelector(selectors.pages.Dashboard.Controls)).toBeVisible();

    const back = dashboardPage.getByGrafanaSelector(
      selectors.components.NavToolbar.editDashboard.backToDashboardButton
    );
    const discard = dashboardPage.getByGrafanaSelector(
      selectors.components.NavToolbar.editDashboard.discardChangesButton
    );

    await expect(back).toBeVisible();
    await expect(discard).toBeVisible();

    // Panel edit no longer renders the nav toolbar, so the only Back action is the one in the
    // controls row — guards against it being re-added to the toolbar.
    await expect(back).toHaveCount(1);
  });

  test('shortens the action labels, keeping the full text in tooltips', async ({ gotoDashboardPage, selectors }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const back = dashboardPage.getByGrafanaSelector(
      selectors.components.NavToolbar.editDashboard.backToDashboardButton
    );
    const discard = dashboardPage.getByGrafanaSelector(
      selectors.components.NavToolbar.editDashboard.discardChangesButton
    );

    await expect(back).toContainText('Back');
    await expect(back).not.toContainText('Back to dashboard');
    await expect(discard).toContainText('Discard');
    await expect(discard).not.toContainText('Discard panel changes');
  });

  test('Back returns to the dashboard', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID, queryParams: editPanelUrl() });

    const content = dashboardPage.getByGrafanaSelector(selectors.components.PanelEditor.General.content);
    await expect(content).toBeVisible();

    await dashboardPage
      .getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.backToDashboardButton)
      .click();

    await expect(content).toBeHidden();
    await expect(page).toHaveURL(/^(?!.*editPanel).*$/);
  });
});
