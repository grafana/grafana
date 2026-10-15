import { test, expect, recordingTargetDataSource } from './fixtures';
import { deleteRule } from './ruleSeeding';

// No filters here, so a per-run title suffix keeps the row unique against the corpus.
test.describe('Recording rules: Recently deleted', () => {
  test('RDEL-3: Review shows metric/target data source and advanced JSON with no server/group data', async ({
    page,
    folder,
    recordingRules,
    workerApi,
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `HTTP error rate ${suffix}`;
    const metric = `http_errors:rate5m_${suffix}`;
    const uid = await recordingRules.seedRule({ title, interval: '1m', metric });
    await deleteRule(page.request, workerApi.namespace, 'recordingrules', uid);

    await page.goto('/alerting/rules/recording/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row.getByRole('cell', { name: metric, exact: true })).toBeVisible();
    await row.getByRole('button', { name: 'Review' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Deleted recording rule')).toBeVisible();
    await expect(drawer.getByText(metric)).toBeVisible();
    await expect(drawer.getByText(recordingTargetDataSource, { exact: false })).toBeVisible();
    await expect(drawer.getByText(/firing|instances|notification routing/i)).not.toBeVisible();

    await drawer.getByRole('button', { name: 'Advanced: Kubernetes JSON' }).click();
    const jsonText = await drawer.textContent();
    expect(jsonText).not.toContain('resourceVersion');
    expect(jsonText).not.toContain('deletionTimestamp');
    expect(jsonText).not.toContain('grafana.com/access');
    expect(jsonText).not.toContain('grafana.com/provenance');
    expect(jsonText).not.toContain('managedFields');
    expect(jsonText).not.toContain('"status"');
    expect(jsonText).toContain(title);
  });

  test('RDEL-1: a deleted Recording rule never appears on the Alert rules deleted tab', async ({
    page,
    recordingRules,
    workerApi,
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `Queue depth trend ${suffix}`;
    const uid = await recordingRules.seedRule({ title, interval: '1m', metric: `queue_depth:trend_${suffix}` });
    await deleteRule(page.request, workerApi.namespace, 'recordingrules', uid);

    await page.goto('/alerting/rules/recording/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

    await page.goto('/alerting/rules/alert/deleted');
    // Loaded once a table or empty state shows; earlier absence checks pass mid-request.
    await expect(
      page.getByRole('columnheader', { name: 'Title' }).or(page.getByText('No recently deleted rules found'))
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeHidden();
  });
});
