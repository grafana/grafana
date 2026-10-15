import { test, expect, recordingTargetDataSource } from './fixtures';
import { deleteRule } from './ruleSeeding';

// Recently deleted has no search/filter controls (by design - the trash selector can't be
// combined with ordinary ones), so unlike the mutation specs there's no folder-scoped view to
// narrow the table to this test's row. A per-invocation suffix keeps the title unique against
// both other runs and the shared seeded corpus, which reuses these same realistic-sounding
// titles (see AGENTS.md) - `exact: true` alone isn't enough since a corpus rule could
// coincidentally share the exact title otherwise.
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
    // Recording review must never imply alert state, instances, or notification routing.
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
    // The other tab has finished loading once it shows either its table or its empty state; asserting
    // absence earlier would pass while the request is still in flight.
    await expect(
      page.getByRole('columnheader', { name: 'Title' }).or(page.getByText('No recently deleted rules found'))
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeHidden();
  });
});
