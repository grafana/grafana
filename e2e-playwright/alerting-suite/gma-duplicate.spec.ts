import { type Page, test, expect } from './fixtures';
import { AlertRuleEditPage } from './pages/AlertRuleEditPage';
import { RuleListPage, type RuleListKind } from './pages/RuleListPage';

// ALERT-6/REC-5: Duplicate opens the existing creation flow prefilled from the source rule
// (`copyFrom=<uid>`); the editor itself is responsible for stripping identity/status/ownership
// when it saves. This spec proves that end-to-end against the real editor rather than assuming
// it - if the editor doesn't strip something the new rule-list code promises, that's a finding
// about the editor, not a bug in the menu that opened it.
//
// Requires alerting.rulesAPIV2 so the ungrouped ("rule-based") evaluation mode is available -
// these rules have no Ruler group to begin with (see create-grafana-rule.spec.ts for the same
// convention).
test.use({
  featureToggles: {
    'alerting.rulesAPIV2': true,
  },
});

async function gotoAlertFolderList(page: Page, folderUid: string): Promise<void> {
  await page.goto(`/alerting/rules/alert?search=${encodeURIComponent(`namespace:${folderUid}`)}&view=list`);
}

async function gotoRecordingFolderList(page: Page, folderUid: string): Promise<void> {
  await page.goto(`/alerting/rules/recording?search=${encodeURIComponent(`namespace:${folderUid}`)}&view=list`);
}

async function markProvisioned(page: Page, kind: 'alertrules' | 'recordingrules', uid: string) {
  const response = await page.request.patch(
    `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/${kind}/${encodeURIComponent(uid)}`,
    {
      headers: { 'Content-Type': 'application/merge-patch+json' },
      data: { metadata: { annotations: { 'grafana.com/provenance': 'api' } } },
    }
  );
  expect(response.ok(), `mark provisioned -> ${response.status()}`).toBeTruthy();
}

async function duplicateThroughMenu(page: Page, kind: RuleListKind, title: string, isProvisioned: boolean) {
  await new RuleListPage(page, kind).rowMoreButton(title).click();
  // Duplicate stays available on a provisioned rule, so an enabled item is what must be found.
  await page.getByRole('menuitem', { name: 'Duplicate', exact: true }).click();

  if (isProvisioned) {
    const dialog = page.getByRole('dialog', { name: 'Copy provisioned rule' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Copy' }).click();
  }

  await expect(page).toHaveURL(/\/alerting\/new/);
}

test.describe('Duplicate (ALERT-6/REC-5)', () => {
  test('ALERT-6: duplicating a normal Alert rule creates an independent copy and leaves the original untouched', async ({
    page,
    folder,
    alertRules,
  }) => {
    const title = `High CPU usage ${crypto.randomUUID().slice(0, 8)}`;
    const originalUid = await alertRules.seedRule({ title, interval: '1m' });

    await gotoAlertFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await duplicateThroughMenu(page, 'alert', title, false);

    await new AlertRuleEditPage(page).saveAndWaitForSuccess('created');
    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const copyUid = new URL(page.url()).pathname.split('/')[3];
    alertRules.trackRule(copyUid);

    expect(copyUid).not.toBe(originalUid);

    const copyResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(copyUid)}`
    );
    expect(copyResponse.ok(), `GET copy -> ${copyResponse.status()}`).toBeTruthy();
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();
    expect(copy.metadata.annotations?.['grafana.app/managerId']).toBeUndefined();
    expect(copy.metadata.labels?.['grafana.com/group']).toBeUndefined();
    expect(copy.metadata.labels?.['grafana.com/group-index']).toBeUndefined();

    const originalResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(originalUid)}`
    );
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
    await markProvisioned(page, 'alertrules', originalUid);

    await gotoAlertFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await duplicateThroughMenu(page, 'alert', title, true);

    await new AlertRuleEditPage(page).saveAndWaitForSuccess('created');
    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const copyUid = new URL(page.url()).pathname.split('/')[3];
    alertRules.trackRule(copyUid);

    const copyResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(copyUid)}`
    );
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();

    const originalResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(originalUid)}`
    );
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

    await gotoRecordingFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await duplicateThroughMenu(page, 'recording', title, false);

    await new AlertRuleEditPage(page).saveAndWaitForSuccess('created');
    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const copyUid = new URL(page.url()).pathname.split('/')[3];
    recordingRules.trackRule(copyUid);

    expect(copyUid).not.toBe(originalUid);

    const copyResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(copyUid)}`
    );
    expect(copyResponse.ok(), `GET copy -> ${copyResponse.status()}`).toBeTruthy();
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();
    expect(copy.metadata.labels?.['grafana.com/group']).toBeUndefined();

    const originalResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(originalUid)}`
    );
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
    await markProvisioned(page, 'recordingrules', originalUid);

    await gotoRecordingFolderList(page, folder.uid);
    await expect(page.getByRole('link', { name: title })).toBeVisible();

    await duplicateThroughMenu(page, 'recording', title, true);

    await new AlertRuleEditPage(page).saveAndWaitForSuccess('created');
    await expect(page).toHaveURL(/\/alerting\/grafana\/[^/]+\/view/);
    const copyUid = new URL(page.url()).pathname.split('/')[3];
    recordingRules.trackRule(copyUid);

    const copyResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(copyUid)}`
    );
    const copy = await copyResponse.json();
    expect(copy.metadata.annotations?.['grafana.com/provenance']).toBeFalsy();
    expect(copy.metadata.annotations?.['grafana.app/managedBy']).toBeUndefined();

    const originalResponse = await page.request.get(
      `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(originalUid)}`
    );
    const original = await originalResponse.json();
    expect(original.metadata.annotations?.['grafana.com/provenance']).toBe('api');
  });
});
