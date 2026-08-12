import { test, expect } from '@grafana/plugin-e2e';

// Same dashboard as text.spec.ts — v2 reads the identical panel options, so the
// two suites cover both implementations of the `text` panel from one fixture.
const DASHBOARD_UID = 'WZ7AhQiVz';

// Panel ids from devenv/dev-dashboards/panel-text/text-options.json.
const MARKDOWN_PANEL = '4';
const HTML_PANEL = '6';
const CODE_PANEL = '5';

// Render mode needs query data, which text-options.json has none of.
const DATA_DASHBOARD_UID = 'adssfc8';
const EVERY_ROW_PANEL = '6';

test.use({ openFeature: { flags: { 'grafana.newTextPanel': true, 'text.newFeatures': true } } });

test.describe('Panels test: Text v2', { tag: ['@panels'] }, () => {
  test('renders all panels on dashboard without errors', async ({ gotoDashboardPage, selectors, page }) => {
    const dashboardPage = await gotoDashboardPage({ uid: DASHBOARD_UID });

    const panelTitles = [
      'Markdown (with variables)',
      'HTML (with variables)',
      'JSON (with variables)',
      'Markdown (code w/ with variables)',
    ];
    for (const title of panelTitles) {
      await expect(dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title(title))).toBeVisible();
    }

    // The v2-only test ids are what prove the flag actually swapped the implementation:
    // v1 renders "TextPanel-converted-content" instead.
    await expect(page.getByTestId('TextNGPanel-converted-content')).toHaveCount(2);
    await expect(page.getByTestId('TextNGPanel-code')).toHaveCount(2);
    await expect(page.getByTestId('TextPanel-converted-content')).toHaveCount(0);

    const errorInfo = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.headerCornerInfo('error'));
    await expect(errorInfo, 'no errors in any panel').toBeHidden();
  });

  test('markdown mode renders and interpolates variables', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: MARKDOWN_PANEL }),
    });

    // In edit mode v2 replaces the panel body with the inline editor, which opens on Preview.
    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('h2').first()).toBeVisible();
    await expect(preview.locator('h3').first()).toBeVisible();
    await expect(preview.locator('hr')).toBeVisible();
    await expect(preview).toContainText('text = temp');
  });

  test('html mode renders content correctly', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: HTML_PANEL }),
    });

    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();
    await expect(preview.locator('h3').first()).toHaveText('Data center');
    await expect(preview.locator('h3')).toHaveCount(4);
  });

  test('code mode renders a read-only CodeMirror view', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: CODE_PANEL }),
    });

    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();

    // v2 swapped Monaco for CodeMirror; v1's equivalent test asserts `.monaco-editor`.
    const codeMirror = preview.locator('.cm-editor');
    await expect(codeMirror).toBeVisible();
    await expect(page.locator('.monaco-editor')).toHaveCount(0);
  });

  test('inline editor switches between preview, split and write views', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: MARKDOWN_PANEL }),
    });

    const editor = page.getByTestId('TextNGEditor');
    await expect(editor).toBeVisible();

    const preview = page.getByTestId('TextNGEditor-preview');
    const writableEditor = editor.locator('.cm-editor');

    // Preview is the default view: rendered output only, no editable surface.
    await expect(preview).toBeVisible();
    await expect(writableEditor).toHaveCount(0);

    await page.getByRole('radio', { name: 'Split' }).click();
    await expect(writableEditor).toBeVisible();
    await expect(preview).toBeVisible();

    await page.getByRole('radio', { name: 'Write' }).click();
    await expect(writableEditor).toBeVisible();
    await expect(preview).toHaveCount(0);

    await page.getByRole('radio', { name: 'Preview' }).click();
    await expect(preview).toBeVisible();
    await expect(writableEditor).toHaveCount(0);
  });

  test('can switch between modes in panel editor', async ({ gotoDashboardPage, page }) => {
    await gotoDashboardPage({
      uid: DASHBOARD_UID,
      queryParams: new URLSearchParams({ editPanel: MARKDOWN_PANEL }),
    });

    const preview = page.getByTestId('TextNGEditor-preview');
    await expect(preview).toBeVisible();

    // Mode lives in the editor toolbar, not the options pane.
    const modePicker = page.getByRole('button', { name: /^Text mode/ });

    await modePicker.click();
    await page.getByRole('menuitemradio', { name: 'HTML' }).click();
    await expect(preview).toBeVisible();

    // Code mode is picked through its language submenu.
    await modePicker.click();
    await page.getByRole('menuitem', { name: 'Code' }).hover();
    await page.getByRole('menuitemradio', { name: 'JSON' }).click();
    await expect(preview.locator('.cm-editor')).toBeVisible();

    await modePicker.click();
    await page.getByRole('menuitemradio', { name: 'Markdown' }).click();
    await expect(preview).toBeVisible();
  });

  test.describe('render template', () => {
    test('renders the content once per data row', async ({ gotoDashboardPage, selectors }) => {
      const dashboardPage = await gotoDashboardPage({ uid: DATA_DASHBOARD_UID });

      const panel = dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.content, {
        root: dashboardPage.getByGrafanaSelector(selectors.components.Panels.Panel.title('Render mode: Per row')),
      });

      // One card per row of the panel's csv_content query.
      await expect(panel.locator('.user-card')).toHaveCount(5);
      await expect(panel).toContainText('Wei');
      await expect(panel).toContainText('editor');
      await expect(panel).toContainText('w.zhang@example.com');
    });

    test('switches back to a single render from the options pane', async ({ gotoDashboardPage, selectors, page }) => {
      const dashboardPage = await gotoDashboardPage({
        uid: DATA_DASHBOARD_UID,
        queryParams: new URLSearchParams({ editPanel: EVERY_ROW_PANEL }),
      });

      const preview = page.getByTestId('TextNGEditor-preview');
      await expect(preview.locator('.user-card')).toHaveCount(5);

      // Unlike Mode, Render mode lives in the options pane, not the toolbar.
      const renderMode = dashboardPage.getByGrafanaSelector(
        selectors.components.PanelEditor.OptionsPane.fieldLabel('Data Render mode')
      );
      await renderMode.getByRole('radio', { name: 'Once' }).click();

      // A single render cannot resolve per-row fields, so the macro stays literal.
      await expect(preview.locator('.user-card')).toHaveCount(1);
      await expect(preview).toContainText('${__data.fields.Id}');
    });
  });
});
