import { type Page, ruleUidFromUrl, test, expect } from './fixtures';
import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { RuleListPage, type RuleListKind, folderScope } from './pages/RuleListPage';
import { markProvisioned, ruleResourceUrl } from './ruleSeeding';

// ALERT-6/REC-5: requires alerting.rulesAPIV2 for ungrouped rules; proves the editor strips identity on save.
test.use({
  featureToggles: {
    'alerting.rulesAPIV2': true,
  },
});

async function saveCopyAndTrack(page: Page, fixture: { trackRule(uid: string): void }): Promise<string> {
  await new AlertRuleEditPage(page).saveAndWaitForSuccess('created');
  await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
  const copyUid = ruleUidFromUrl(page.url());
  fixture.trackRule(copyUid);
  return copyUid;
}

async function duplicateThroughMenu(page: Page, kind: RuleListKind, title: string) {
  await new RuleListPage(page, kind).rowMoreButton(title).click();
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();

  await expect(page).toHaveURL(/\/alerting\/new(\/grafana-recording)?\?.*copyFrom=/);
}

async function confirmCopyOfProvisionedRule(page: Page, kind: RuleListKind, title: string) {
  await new RuleListPage(page, kind).rowMoreButton(title).click();
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();

  const dialog = page.getByRole('dialog', {
    name: kind === 'alert' ? 'Copy provisioned alert rule' : 'Copy provisioned recording rule',
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('The new rule will not be marked as a provisioned rule.');
  await expect(dialog).toContainText('You will need to set a new evaluation group for the copied rule');
  await dialog.getByRole('button', { name: 'Copy' }).click();

  await expect(page).toHaveURL(/\/alerting\/new(\/grafana-recording)?\?.*copyFrom=/);
}

test.describe('Duplicate (ALERT-6/REC-5)', () => {
  test('ALERT-6: duplicating a normal Alert rule creates an independent copy and leaves the original untouched', async ({
    page,
    folder,
    alertRules,
  }) => {
    const title = `High CPU usage ${crypto.randomUUID().slice(0, 8)}`;
    const originalUid = await alertRules.seedRule({ title, interval: '1m' });

    await new RuleListPage(page, 'alert').goto(folderScope(folder.uid));
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await duplicateThroughMenu(page, 'alert', title);

    const copyUid = await saveCopyAndTrack(page, alertRules);

    expect(copyUid).not.toBe(originalUid);

    const copyResponse = await page.request.get(await ruleResourceUrl(page.request, 'alertrules', copyUid));
    expect(copyResponse.ok(), `GET copy -> ${copyResponse.status()}`).toBeTruthy();
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();
    expect(copy.metadata.annotations?.['grafana.app/managerId']).toBeUndefined();
    expect(copy.metadata.labels?.['grafana.com/group']).toBeUndefined();
    expect(copy.metadata.labels?.['grafana.com/group-index']).toBeUndefined();

    const originalResponse = await page.request.get(await ruleResourceUrl(page.request, 'alertrules', originalUid));
    expect(originalResponse.ok(), `GET original -> ${originalResponse.status()}`).toBeTruthy();
    const original = await originalResponse.json();
    expect(original.spec.title).toBe(title);
  });

  test('ALERT-6: duplicating a provisioned-looking Alert rule warns first, then creates an unprovisioned copy', async ({
    page,
    folder,
    alertRules,
  }) => {
    const title = `Disk space low ${crypto.randomUUID().slice(0, 8)}`;
    const originalUid = await alertRules.seedRule({ title, interval: '1m' });
    await markProvisioned(page.request, 'alertrules', originalUid);

    await new RuleListPage(page, 'alert').goto(folderScope(folder.uid));
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await confirmCopyOfProvisionedRule(page, 'alert', title);

    const copyUid = await saveCopyAndTrack(page, alertRules);

    const copyResponse = await page.request.get(await ruleResourceUrl(page.request, 'alertrules', copyUid));
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();

    const originalResponse = await page.request.get(await ruleResourceUrl(page.request, 'alertrules', originalUid));
    const original = await originalResponse.json();
    expect(original.metadata.annotations?.['grafana.com/provenance']).toBe('api');
  });

  test('REC-5: duplicating a normal Recording rule creates an independent copy and leaves the original untouched', async ({
    page,
    folder,
    recordingRules,
  }) => {
    const title = `CPU usage average ${crypto.randomUUID().slice(0, 8)}`;
    const metric = `cpu_usage_avg_${crypto.randomUUID().slice(0, 8)}`;
    const originalUid = await recordingRules.seedRule({ title, interval: '1m', metric });

    await new RuleListPage(page, 'recording').goto(folderScope(folder.uid));
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await duplicateThroughMenu(page, 'recording', title);

    const copyUid = await saveCopyAndTrack(page, recordingRules);

    expect(copyUid).not.toBe(originalUid);

    const copyResponse = await page.request.get(await ruleResourceUrl(page.request, 'recordingrules', copyUid));
    expect(copyResponse.ok(), `GET copy -> ${copyResponse.status()}`).toBeTruthy();
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();
    expect(copy.metadata.labels?.['grafana.com/group']).toBeUndefined();

    const originalResponse = await page.request.get(await ruleResourceUrl(page.request, 'recordingrules', originalUid));
    const original = await originalResponse.json();
    expect(original.spec.title).toBe(title);
  });

  test('REC-5: duplicating a provisioned-looking Recording rule warns first, then creates an unprovisioned copy', async ({
    page,
    folder,
    recordingRules,
  }) => {
    const title = `Disk usage forecast ${crypto.randomUUID().slice(0, 8)}`;
    const metric = `disk_usage_forecast_${crypto.randomUUID().slice(0, 8)}`;
    const originalUid = await recordingRules.seedRule({ title, interval: '1m', metric });
    await markProvisioned(page.request, 'recordingrules', originalUid);

    await new RuleListPage(page, 'recording').goto(folderScope(folder.uid));
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await confirmCopyOfProvisionedRule(page, 'recording', title);

    const copyUid = await saveCopyAndTrack(page, recordingRules);

    const copyResponse = await page.request.get(await ruleResourceUrl(page.request, 'recordingrules', copyUid));
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();

    const originalResponse = await page.request.get(await ruleResourceUrl(page.request, 'recordingrules', originalUid));
    const original = await originalResponse.json();
    expect(original.metadata.annotations?.['grafana.com/provenance']).toBe('api');
  });
});
