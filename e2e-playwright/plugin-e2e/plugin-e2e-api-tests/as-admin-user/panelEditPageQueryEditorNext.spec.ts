import { expect, test } from '@grafana/plugin-e2e';

import { formatExpectError } from '../errors';
import { scenarios } from '../mocks/resources';

// openFeature is worker-scoped, so the new editor needs its own file next to the classic panelEditPage.spec.ts.
test.use({
  openFeature: {
    flags: {
      queryEditorNext: true,
    },
  },
});

test.describe(
  'plugin-e2e-api-tests admin',
  {
    tag: ['@plugins'],
  },
  () => {
    test.describe('getQueryEditorRow in the new query editor', () => {
      test('fills query A controls', async ({ panelEditPage }) => {
        await panelEditPage.datasource.set('gdev-testdata');
        const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
        await queryEditorRow.getByLabel('Labels').fill('invalid-label-format');
        await expect(panelEditPage.refreshPanel(), formatExpectError('Expected panel query to fail')).not.toBeOK();
      });

      test('opens query A scenario select with mocked `scenarios` resource', async ({ selectors, dashboardPage }) => {
        await dashboardPage.mockResourceResponse('scenarios', scenarios);
        const panelEditPage = await dashboardPage.addPanel();
        await panelEditPage.datasource.set('gdev-testdata');
        const queryEditorRow = await panelEditPage.getQueryEditorRow('A');
        await queryEditorRow.getByLabel('Scenario').last().click();
        await expect(
          panelEditPage.getByGrafanaSelector(selectors.components.Select.option),
          formatExpectError('Expected certain select options to be displayed after clicking on the select input')
        ).toHaveText(scenarios.map((s) => s.name));
      });

      test('finds query B by refId without touching query A', async ({ panelEditPage, page }) => {
        await panelEditPage.datasource.set('gdev-testdata');
        await page.getByRole('button', { name: 'Add query', exact: true }).click();
        const queryB = await panelEditPage.getQueryEditorRow('B');
        await queryB.getByLabel('Labels').fill('invalid-label-format');
        const queryA = await panelEditPage.getQueryEditorRow('A');
        await expect(queryA.getByLabel('Labels')).toHaveValue('');
        await expect(panelEditPage.refreshPanel(), formatExpectError('Expected panel query to fail')).not.toBeOK();
      });
    });
  }
);
