import * as e2e from '@grafana/e2e-selectors';
import { expect, test } from '@grafana/plugin-e2e';

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('Loki editor', () => {
      test('Autocomplete features should work as expected.', async ({ page }) => {
        // Go to loki datasource in explore
        await page.goto(
          '/explore?schemaVersion=1&panes=%7B%22iap%22:%7B%22datasource%22:%22gdev-loki%22,%22queries%22:%5B%7B%22refId%22:%22A%22,%22expr%22:%22%22,%22queryType%22:%22range%22,%22datasource%22:%7B%22type%22:%22loki%22,%22uid%22:%22gdev-loki%22%7D,%22editorMode%22:%22builder%22%7D%5D,%22range%22:%7B%22from%22:%22now-1h%22,%22to%22:%22now%22%7D%7D%7D&orgId=1'
        );

        const queryEditor = page.getByTestId(e2e.selectors.components.QueryField.container);
        const queryEditorRows = page.getByTestId('query-editor-rows');

        async function assertQueryEditorEmpty() {
          const queryEditorEmptyText = /^Enter to Rename.+/;
          await expect(queryEditor).toHaveText(queryEditorEmptyText);
        }

        async function clearInput() {
          // Clear focused input
          // Monaco appears to need some time to init keybindings after a change, adding this timeout to prevent flake
          await page.waitForTimeout(100);
          await page.keyboard.press('ControlOrMeta+A');
          await page.keyboard.press('Backspace');
        }

        // assert that the query builder is shown by default
        await expect(page.getByText('Label filters')).toHaveCount(1);

        // switch to code editor
        await page.getByLabel('Code').click();

        await page.waitForFunction(() => window.monaco);
        await expect(queryEditor).toHaveCount(1);
        await assertQueryEditorEmpty();

        // assert editor automatically adds close paren
        await queryEditor.click();
        await page.keyboard.type('time(');
        await expect(queryEditor).toContainText('time()');

        // removes closing brace when opening brace is removed
        await clearInput();
        await assertQueryEditorEmpty();
        await page.keyboard.type('avg_over_time(');
        await expect(queryEditor).toContainText('avg_over_time()');
        await page.keyboard.press('Backspace');
        await expect(queryEditor).not.toContainText('avg_over_time()');
        await expect(queryEditor).toContainText('avg_over_time');

        // keeps closing brace when opening brace is removed and inner values exist
        await clearInput();
        await assertQueryEditorEmpty();
        await page.keyboard.type('time(test');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('ArrowLeft');
        await page.keyboard.press('Backspace');
        await expect(queryEditor).toContainText('timetest');

        // overrides an automatically inserted paren
        await clearInput();
        await assertQueryEditorEmpty();
        await page.keyboard.type('time()');
        await expect(queryEditor).toContainText('time()');

        // does not override manually inserted braces
        await clearInput();
        await assertQueryEditorEmpty();
        await page.keyboard.type('))');
        await expect(queryEditor).toContainText('))');

        // Should execute the query when enter with shift is pressed
        await clearInput();
        await assertQueryEditorEmpty();
        await page.keyboard.press('Shift+Enter');
        await expect(page.getByTestId('explore-no-data')).toHaveCount(1);

        // Suggestions plugin
        await clearInput();
        await assertQueryEditorEmpty();
        await page.keyboard.type('av');
        await expect(queryEditorRows.getByLabel(/avg, docs:/)).toHaveCount(1);
        await expect(queryEditorRows.getByLabel(/avg_over_time, docs:/)).toHaveCount(1);
      });
    });
  }
);
