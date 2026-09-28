import { type Locator } from 'playwright-core';

export async function fillMonacoEditor(editor: Locator, value: string) {
  await editor.locator('.view-lines').click();
  await editor.page().keyboard.press('ControlOrMeta+A');
  await editor.page().keyboard.insertText(value);
}
