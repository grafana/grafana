import { test } from '@grafana/plugin-e2e';

import { expectNewTextReloadsAfterFirstQuery, TEXT_FLAGS } from './text-queries-utils';

// openFeature is worker-scoped, so the classic editor needs its own file next to text-queries.spec.ts.
test.use({ openFeature: { flags: { ...TEXT_FLAGS, queryEditorNext: false } } });

test.describe('Text query lifecycle with the classic query editor', { tag: ['@panels'] }, () => {
  test('new Text reloads the inline editor with data after adding the first query', async ({
    gotoDashboardPage,
    page,
    selectors,
  }) => {
    const dashboard = await gotoDashboardPage({});
    await expectNewTextReloadsAfterFirstQuery(dashboard, page, selectors, false);
  });
});
