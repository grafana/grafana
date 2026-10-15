import { test, expect } from './fixtures';

// Recently deleted has no search/filter controls (by design - the trash selector can't be
// combined with ordinary ones), so unlike the mutation specs there's no folder-scoped view to
// narrow the table to this test's row. A per-invocation suffix keeps the title unique against
// both other runs and the shared seeded corpus, which reuses these same realistic-sounding
// titles (see AGENTS.md) - `exact: true` alone isn't enough since a corpus rule could
// coincidentally share the exact title otherwise.
test.describe('Alert rules: Recently deleted', () => {
  test('ADEL-3: Review shows a sanitized human-readable preview and advanced JSON with no server/group data', async ({
    page,
    folder,
    alertRules,
    workerApi,
  }) => {
    const title = `Node load average ${crypto.randomUUID().slice(0, 8)}`;
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    const deleted = await page.request.delete(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${workerApi.namespace}/alertrules/${encodeURIComponent(uid)}`
    );
    expect(deleted.ok(), `DELETE alertrules/${uid} -> ${deleted.status()} ${await deleted.text()}`).toBeTruthy();

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
    workerApi,
  }) => {
    const title = `Pod restart rate ${crypto.randomUUID().slice(0, 8)}`;
    const uid = await alertRules.seedRule({ title, interval: '1m' });
    const deleted = await page.request.delete(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/${workerApi.namespace}/alertrules/${encodeURIComponent(uid)}`
    );
    expect(deleted.ok(), `DELETE alertrules/${uid} -> ${deleted.status()} ${await deleted.text()}`).toBeTruthy();

    await page.goto('/alerting/rules/alert/deleted');
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible();

    await page.goto('/alerting/rules/recording/deleted');
    // The other tab has finished loading once it shows either its table or its empty state; asserting
    // absence earlier would pass while the request is still in flight.
    await expect(
      page.getByRole('columnheader', { name: 'Title' }).or(page.getByText('No recently deleted rules found'))
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: title, exact: true })).toBeHidden();
  });
});
