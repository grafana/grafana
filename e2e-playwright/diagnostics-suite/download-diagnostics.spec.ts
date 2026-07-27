import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { test, expect } from '@grafana/plugin-e2e';

// Flow 2 of the on-prem diagnostics "storybook" (see fabrizio-notes on-prem-diagnostics/e2e/
// storybook-and-e2e-plan.md): drive the REAL "Download diagnostics" drawer end-to-end, capture the
// downloaded bundle, and assert it carries the root-cause evidence for the use case.
//
// Prereqs (the scheduled on-prem tier / `story.sh` provides these): a full-stack Grafana that is
// ON-PREM (empty stack_id), admin, with `grafana.onDemandDiagnostics` on, and the story already
// provisioned — `story.sh run <case>` creates datasource `story-ds-<case>` + dashboard `story-<case>`.
// The shared cloud-mode e2e (stack_id=12345) hides the drawer, so this self-skips there and is meant
// to run against the on-prem story Grafana via GRAFANA_URL.

const STORY = 'server-error';
const DASH_UID = `story-${STORY}`;
// Pinned window matching story.sh's fixed clock (FAULT_FIXED_NOW=1700000000, last 5 min).
const FIXED = 1700000000;
const FROM = String((FIXED - 300) * 1000);
const TO = String(FIXED * 1000);

test.describe('diagnostics: Download diagnostics drawer', { tag: ['@diagnostics'] }, () => {
  test('server-error — the downloaded bundle localizes the upstream 500', async ({
    page,
    gotoDashboardPage,
  }, testInfo) => {
    // Flow 3 capture — first the panel state a user reports (the "before"): the failing panel.
    await gotoDashboardPage({ uid: DASH_UID, queryParams: new URLSearchParams({ from: FROM, to: TO }) });
    await page.getByText('up (datasource returns HTTP 500)').waitFor({ state: 'visible', timeout: 15_000 });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.screenshot({ path: testInfo.outputPath('panel.png') });

    // Then land straight in the Download diagnostics drawer on the provisioned story dashboard.
    await gotoDashboardPage({
      uid: DASH_UID,
      queryParams: new URLSearchParams({ from: FROM, to: TO, shareView: 'download_diagnostics' }),
    });

    const button = page.getByRole('button', { name: 'Download diagnostics' });
    // On-prem guard: the menu/drawer only renders for isOnPrem() + admin + toggle. If it never
    // appears we're on a cloud-mode instance — skip rather than fail. (waitFor actually waits; note
    // isVisible() does NOT — it returns immediately, before the async drawer has rendered.)
    const available = await button
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false);
    test.skip(!available, 'Download diagnostics drawer unavailable (needs on-prem + admin + toggle)');

    // Flow 3 capture — the drawer as the user sees it before generating.
    await page.screenshot({ path: testInfo.outputPath('drawer.png') });

    const downloadPromise = page.waitForEvent('download', { timeout: 60_000 });
    await button.click();
    const download = await downloadPromise;

    const bundle = join(mkdtempSync(join(tmpdir(), 'diag-story-')), 'bundle.tar.gz');
    await download.saveAs(bundle);

    // Assert the bundle proves the root cause (the evidence the drawer is for). The whole-dashboard
    // bundle nests evidence under panels/<id>-<slug>/; the single-panel bundle keeps it top-level.
    // (A main build also embeds querydata.json; the HAR + query-error already localize the upstream 500.)
    const members = execFileSync('tar', ['tzf', bundle], { encoding: 'utf8' }).split('\n').filter(Boolean);
    const har = members.find((m) => m === 'traffic.har' || m.endsWith('/traffic.har'));
    const queryErrorPath = members.find((m) => m === 'query-error.txt' || m.endsWith('/query-error.txt'));
    expect(har, `bundle should contain a captured upstream exchange (members: ${members.join(', ')})`).toBeTruthy();
    expect(queryErrorPath, 'bundle should contain the verbatim query error').toBeTruthy();

    const harText = execFileSync('tar', ['xOzf', bundle, har!], { encoding: 'utf8' });
    expect(harText, 'traffic.har should show the upstream 500 + root-cause body').toMatch(/500/);
    expect(harText).toMatch(/shard unavailable/);

    const queryErrorText = execFileSync('tar', ['xOzf', bundle, queryErrorPath!], { encoding: 'utf8' });
    expect(queryErrorText, 'query-error.txt should quote the user-visible failure').toMatch(/500|shard unavailable/);
  });
});
