import { test, expect, type DashboardPage, type E2ESelectorGroups } from '@grafana/plugin-e2e';

// Same dashboard as text-v2.spec.ts, which covers the panel with dashboard editing off. The
// openFeature and featureToggles fixtures are worker scoped, so the on case needs its own file.
const DASHBOARD_UID = 'WZ7AhQiVz';
const MARKDOWN_PANEL_TITLE = 'Markdown (with variables)';

// Selection, which is what opens the editor, is only enabled by the new dashboard layouts.
test.use({
  openFeature: { flags: { 'grafana.newTextPanel': true, 'text.dashboardEditor': true } },
  featureToggles: { dashboardNewLayouts: true },
});

function markdownPanel(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  return dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(MARKDOWN_PANEL_TITLE));
}

// Selecting via the header is deterministic; a click on rendered markdown can land on a link, which
// the panel chrome already exempts from selection.
function panelHeader(dashboardPage: DashboardPage, selectors: E2ESelectorGroups) {
  return dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerContainer, {
    root: markdownPanel(dashboardPage, selectors),
  });
}

test.describe('Panels test: Text v2 editing from the dashboard', { tag: ['@panels'] }, () => {
  test('selecting a text panel in edit mode swaps the body for the editor', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    const panel = markdownPanel(dashboardPage, selectors);

    await panelHeader(dashboardPage, selectors).click();

    await expect(page.getByTestId('TextNGEditor')).toBeVisible();
    await expect(panel.getByTestId('TextNGPanel-converted-content')).toBeHidden();

    // Selecting a panel is a deliberate move to edit it, so it opens on the text, and there is no
    // room in a panel for the split view.
    await expect(page.getByRole('radio', { name: 'Write' })).toBeChecked();
    await expect(page.getByRole('radio', { name: 'Split' })).toBeHidden();

    // Clicking the header again deselects, which closes the editor.
    await panelHeader(dashboardPage, selectors).click();

    await expect(page.getByTestId('TextNGEditor')).toBeHidden();
    await expect(panel.getByTestId('TextNGPanel-converted-content')).toBeVisible();
  });

  test('interacting with the editor does not deselect the panel and close it', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await panelHeader(dashboardPage, selectors).click();

    const editor = page.getByTestId('TextNGEditor');
    await expect(editor).toBeVisible();

    // The view radios and the text surface are not exempt from the panel chrome's select-on-click,
    // and selecting an already selected panel deselects it, so without containment either of these
    // would unmount the editor mid-edit.
    await page.getByRole('radio', { name: 'Preview' }).click();
    await expect(editor).toBeVisible();
    await page.getByRole('radio', { name: 'Write' }).click();
    await expect(editor).toBeVisible();

    const content = editor.locator('.cm-content');
    await content.click();
    await page.keyboard.type(' inline edit');

    await expect(editor).toBeVisible();
    await expect(content).toContainText('inline edit');
  });

  test('an inline edit reaches the dashboard as an unsaved change', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });
    await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();
    await panelHeader(dashboardPage, selectors).click();

    // The editor already opens on the text, so this goes straight to typing.
    await page.getByTestId('TextNGEditor').locator('.cm-content').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' Added inline.');

    // Deselecting blurs the editor first, which commits the draft before it unmounts.
    await panelHeader(dashboardPage, selectors).click();

    await expect(markdownPanel(dashboardPage, selectors).getByTestId('TextNGPanel-converted-content')).toContainText(
      'Added inline.'
    );
    await expect(
      dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton)
    ).toBeEnabled();
  });

  test('does not open the editor when the dashboard is not in edit mode', async ({
    gotoDashboardPage,
    selectors,
    page,
  }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    await panelHeader(dashboardPage, selectors).click();

    await expect(page.getByTestId('TextNGEditor')).toBeHidden();
    await expect(markdownPanel(dashboardPage, selectors).getByTestId('TextNGPanel-converted-content')).toBeVisible();
  });
});
