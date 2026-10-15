import { test, expect } from './fixtures';
import { deleteRule } from './ruleSeeding';

// No filters here, so a per-run title suffix keeps the row unique against the corpus.
test.describe('Alert rules: Recently deleted', () => {
  test('ADEL-3: Review shows a sanitized human-readable preview and advanced JSON with no server/group data', async ({
    page,
    folder,
    alertRules,
    workerApi,
  }) => {
    const title = `Node load average ${crypto.randomUUID().slice(0, 8)}`;
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    await deleteRule(page.request, workerApi.namespace, 'alertrules', uid);

    await page.goto('/alerting/rules/alert/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row.getByRole('cell', { name: folder.title })).toBeVisible();
    await row.getByRole('button', { name: 'Review' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Deleted alert rule')).toBeVisible();
    await expect(drawer.getByText(folder.title)).toBeVisible();

    await drawer.getByRole('button', { name: 'Advanced: Kubernetes JSON' }).click();
    const jsonText = await drawer.textContent();
    // Tombstone fields must not leak into the advanced view.
    expect(jsonText).not.toContain('resourceVersion');
    expect(jsonText).not.toContain('deletionTimestamp');
    expect(jsonText).not.toContain('grafana.com/access');
    expect(jsonText).not.toContain('grafana.com/provenance');
    expect(jsonText).not.toContain('managedFields');
    expect(jsonText).not.toContain('"status"');
    expect(jsonText).toContain(title);
  });

  test('ADEL-1: a deleted Alert rule never appears on the Recording rules deleted tab', async ({
    page,
    alertRules,
    workerApi,
  }) => {
    const title = `Pod restart rate ${crypto.randomUUID().slice(0, 8)}`;
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    await deleteRule(page.request, workerApi.namespace, 'alertrules', uid);

    await page.goto('/alerting/rules/alert/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

    await page.goto('/alerting/rules/recording/deleted');
    // Loaded once a table or empty state shows; earlier absence checks pass mid-request.
    await expect(
      page.getByRole('columnheader', { name: 'Title' }).or(page.getByText('No recently deleted rules found'))
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeHidden();
  });
});
