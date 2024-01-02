import { expect, test } from '@grafana/plugin-e2e';

test('query data response should be OK when query is valid', async ({ explorePage, page }) => {
  await explorePage.datasource.set('gdev-testdata');
  await expect(explorePage.runQuery()).toBeOK();
});

test('query data response should not be OK when query is invalid', async ({ explorePage }) => {
  await explorePage.datasource.set('gdev-testdata');
  const queryEditorRow = await explorePage.getQueryEditorRow('A');
  await queryEditorRow.getByLabel('Labels').fill('invalid-label-format');
  await expect(explorePage.runQuery()).not.toBeOK();
});
