import { test, expect } from './fixtures';
import { gotoResilient } from './waitForAppLoad';

// Recently deleted has no search/filter controls (by design - the trash selector can't be
// combined with ordinary ones), so unlike the mutation specs there's no folder-scoped view to
// narrow the table to this test's row. A per-invocation suffix keeps the title unique against
// both other runs and the shared seeded corpus, which reuses these same realistic-sounding
// titles (see AGENTS.md) - `exact: true` alone isn't enough since a corpus rule could
// coincidentally share the exact title otherwise.
test.describe('Alert rules: Recently deleted', () => {
  test.slow();

  test('ADEL-3: Review shows a sanitized human-readable preview and advanced JSON with no server/group data', async ({
    page,
    folder,
    alertRules,
  }) => {
    const title = `Node load average ${crypto.randomUUID().slice(0, 8)}`;
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    await page.request.delete(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(uid)}`
    );

    await gotoResilient(page, '/alerting/rules/alert/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible({ timeout: 40_000 });

    const row = page.getByRole('row', { name: new RegExp(title) });
    await expect(row.getByRole('cell', { name: folder.title })).toBeVisible();
    await row.getByRole('button', { name: 'Review' }).click();

    const drawer = page.getByRole('dialog');
    await expect(drawer.getByText('Deleted alert rule')).toBeVisible();
    await expect(drawer.getByText(folder.title)).toBeVisible();

    await drawer.getByRole('button', { name: 'Advanced: Kubernetes JSON' }).click();
    const jsonText = await drawer.textContent();
    // Sanitized: the tombstone's own resourceVersion/deletionTimestamp/access/provenance/group
    // fields (all present on the raw resource - see fixtures.ts's seedRule/the trash response)
    // must not leak into the advanced view.
    expect(jsonText).not.toContain('resourceVersion');
    expect(jsonText).not.toContain('deletionTimestamp');
    expect(jsonText).not.toContain('grafana.com/access');
    expect(jsonText).not.toContain('grafana.com/provenance');
    expect(jsonText).not.toContain('managedFields');
    expect(jsonText).not.toContain('"status"');
    // The preview must still contain the rule's own definition.
    expect(jsonText).toContain(title);
  });

  test('ADEL-1: a deleted Alert rule never appears on the Recording rules deleted tab', async ({
    page,
    alertRules,
  }) => {
    const title = `Pod restart rate ${crypto.randomUUID().slice(0, 8)}`;
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    await page.request.delete(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(uid)}`
    );

    await gotoResilient(page, '/alerting/rules/alert/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible({ timeout: 40_000 });

    await gotoResilient(page, '/alerting/rules/recording/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).not.toBeVisible({ timeout: 20_000 });
  });
});
