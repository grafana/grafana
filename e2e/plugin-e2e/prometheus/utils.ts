import { expect, type E2ESelectorGroups, type GrafanaPage } from '@grafana/plugin-e2e';

/**
 * On a page with a Prometheus query editor, sets the editor to code mode.
 *
 * @param grafanaPage - The Grafana page object containing the editor
 * @param selectors - Grafana selectors object for finding UI elements
 */
export async function setEditorMode<P extends GrafanaPage>(
  grafanaPage: P,
  selectors: E2ESelectorGroups,
  mode: 'code' | 'builder'
) {
  const editorModeToggle = await grafanaPage.getByGrafanaSelector(
    selectors.components.DataSource.Prometheus.queryEditor.editorToggle
  );
  const codeModeButton = await editorModeToggle.locator(`css=input[id*="option-${mode}"]`); // the id contains a random string, so we use a partial match
  await expect(codeModeButton).toBeVisible();
  await codeModeButton.click();
}

/**
 * Enters a query expression into the Monaco code editor and waits for Grafana to process it.
 *
 * @param grafanaPage - The Grafana page object containing the editor
 * @param selectors - Grafana selectors object for finding UI elements
 * @param expr - The query expression to enter
 */
export async function enterCodeEditorQueryExpr<P extends GrafanaPage>(
  grafanaPage: P,
  selectors: E2ESelectorGroups,
  expr: string
) {
  const codeEditor = await grafanaPage
    .getByGrafanaSelector(selectors.components.ReactMonacoEditor.editorLazy)
    .locator('css=textarea');
  await expect(codeEditor).toBeVisible();
  await codeEditor.click();
  await codeEditor.fill(expr);
  await codeEditor.press('Tab');
  const queryFieldContainer = await grafanaPage.getByGrafanaSelector(selectors.components.QueryField.container);

  // Wait for the 'data-queryexpr' attribute to be set correctly,
  // which indicates that the `onChange` handler has been called
  // and the query expression has been updated. This is needed
  // because we debounce inputs to the Monaco editor.
  await expect(async () => {
    const codeEditorExpr = await queryFieldContainer.getAttribute('data-queryexpr');

    // The attribute might be null at first, so we need to explicitly check for that
    if (codeEditorExpr === null) {
      throw new Error('data-queryexpr attribute not yet set');
    }
    expect(codeEditorExpr).toBe(expr);
  }).toPass();
}
