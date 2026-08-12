import { expect, test } from '@grafana/plugin-e2e';

import { tableNameWithSpecialCharacter } from './mocks/mysql.mocks';
import { mockDataSourceRequest } from './utils';

test.beforeEach(mockDataSourceRequest);

test(
  'code editor autocomplete should handle table name escaping/quoting',
  {
    tag: '@plugins',
  },
  async ({ explorePage, selectors, page }) => {
    await page.getByLabel('Code').check();

    const editor = explorePage.getByGrafanaSelector(selectors.components.CodeEditor.container).getByRole('textbox');
    await editor.fill('S');
    await page.getByLabel('SELECT <column> FROM <table>').locator('a').click();
    await expect(page.getByLabel(tableNameWithSpecialCharacter)).toBeVisible();
    await page.keyboard.press('Enter');

    await expect(editor).toHaveValue(`SELECT  FROM grafana.\`${tableNameWithSpecialCharacter}\``);

    for (let i = 0; i < tableNameWithSpecialCharacter.length + 2; i++) {
      await page.keyboard.press('Backspace');
    }

    await page.keyboard.press('Control+I');
    await expect(page.getByLabel(tableNameWithSpecialCharacter)).toBeVisible();
  }
);
