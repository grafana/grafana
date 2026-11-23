import { test, expect, type Page } from '@playwright/test';

import { selectors } from '@grafana/e2e-selectors';

type StoryWindow = Window & {
  __STORYBOOK_ADDONS_CHANNEL__: {
    on: (event: string, cb: (e: { data: { name: string; args: unknown } }) => void) => void;
  };
  recordAction: (name: string, value: unknown) => void;
};

async function openEditor(page: Page, args: string) {
  await page.goto(`/iframe.html?id=inputs-codeeditor--basic&viewMode=story&args=${args}`);
  const lines = page.getByTestId(selectors.components.CodeEditor.container).locator('.view-lines');
  await expect(lines).toHaveText('SELECT');
  return lines;
}

// The story reports onSave/onBlur through Storybook actions, so collect them off the preview channel
async function recordActions(page: Page) {
  const actions: Array<{ name: string; value: unknown }> = [];
  await page.exposeFunction('recordAction', (name: string, value: unknown) => actions.push({ name, value }));
  await page.evaluate(() => {
    const w = window as unknown as StoryWindow;
    w.__STORYBOOK_ADDONS_CHANNEL__.on('storybook/actions/action-event', (e) =>
      w.recordAction(e.data.name, e.data.args)
    );
  });
  return () => actions;
}

async function appendToEditor(page: Page, lines: ReturnType<Page['locator']>, text: string) {
  await lines.click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
}

test.describe('CodeEditor', () => {
  test('edits the content when typing', async ({ page }) => {
    const lines = await openEditor(page, 'value:SELECT');

    await appendToEditor(page, lines, ' 42');

    await expect(lines).toHaveText('SELECT 42');
  });

  test('does not change the content when readOnly', async ({ page }) => {
    const lines = await openEditor(page, 'value:SELECT;readOnly:!true');

    await appendToEditor(page, lines, ' 42');

    await expect(page.locator('.monaco-editor-overlaymessage')).toHaveText('Cannot edit in read-only editor');
    await expect(lines).toHaveText('SELECT');
  });

  test('calls onSave with the edited value on Ctrl/Cmd+S', async ({ page }) => {
    const lines = await openEditor(page, 'value:SELECT');
    const getActions = await recordActions(page);

    await appendToEditor(page, lines, ' 42');
    await page.keyboard.press('ControlOrMeta+S');

    await expect.poll(getActions).toEqual([{ name: 'code saved', value: 'SELECT 42' }]);
  });

  test('calls onBlur with the edited value when focus leaves the editor', async ({ page }) => {
    const lines = await openEditor(page, 'value:SELECT');
    const getActions = await recordActions(page);

    await appendToEditor(page, lines, ' 42');
    await page.keyboard.press('Escape'); // close the suggestions widget so it doesn't swallow the click
    await page.locator('body').click({ position: { x: 1, y: 1 } });

    await expect.poll(getActions).toEqual([{ name: 'code blur', value: 'SELECT 42' }]);
  });
});
