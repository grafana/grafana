import { test, expect, recordingTargetDataSource } from './fixtures';
import { gotoResilient } from './waitForAppLoad';

// Recently deleted has no search/filter controls (by design - the trash selector can't be
// combined with ordinary ones), so unlike the mutation specs there's no folder-scoped view to
// narrow the table to this test's row. A per-invocation suffix keeps the title unique against
// both other runs and the shared seeded corpus, which reuses these same realistic-sounding
// titles (see AGENTS.md) - `exact: true` alone isn't enough since a corpus rule could
// coincidentally share the exact title otherwise.
test.describe('Recording rules: Recently deleted', () => {
  test.slow();

  test('RDEL-3: Review shows metric/target data source and advanced JSON with no server/group data', async ({
    page,
    folder,
    recordingRules,
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `HTTP error rate ${suffix}`;
    const metric = `http_errors:rate5m_${suffix}`;
    const uid = await recordingRules.seedRule({ title, interval: '1m', metric });
    await page.request.delete(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(uid)}`
    );

    await gotoResilient(page, '/alerting/rules/recording/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible({ timeout: 40_000 });

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
  }) => {
    const suffix = crypto.randomUUID().slice(0, 8);
    const title = `Queue depth trend ${suffix}`;
    const uid = await recordingRules.seedRule({ title, interval: '1m', metric: `queue_depth:trend_${suffix}` });
    await page.request.delete(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(uid)}`
    );

    await gotoResilient(page, '/alerting/rules/recording/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible({ timeout: 40_000 });

    await gotoResilient(page, '/alerting/rules/alert/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).not.toBeVisible({ timeout: 20_000 });
  });
});
