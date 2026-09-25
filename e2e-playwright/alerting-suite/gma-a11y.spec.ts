import { type AxeResults, type AxeScanContext, DEFAULT_A11Y_TAGS } from '@grafana/plugin-e2e';

import { type Page, test, expect } from './fixtures';
import { gotoResilient } from './waitForAppLoad';

// Scoped to this test's own folder (namespace:<uid>) so Folders mode shows exactly one row
// regardless of whatever else exists in the dev instance - same technique the mutation specs
// use, and needed here so "one folder expanded" is deterministic rather than whichever folder
// happens to sort first.
function foldersModeUrl(kind: 'alert' | 'recording', folderUid: string): string {
  const path = kind === 'alert' ? '/alerting/rules/alert' : '/alerting/rules/recording';
  return `${path}?search=${encodeURIComponent(`namespace:${folderUid}`)}`;
}

function listModeUrl(kind: 'alert' | 'recording', folderUid: string): string {
  return `${foldersModeUrl(kind, folderUid)}&view=list`;
}

// axe's exclude only takes CSS selector strings (this @axe-core/playwright version pushes them
// straight through - it doesn't resolve Playwright Locators), so both exclusions below are
// plain attribute selectors rather than Locators.

// NestedFolderPicker (search/AlertRulesFilterSidebar.tsx, search/RecordingRulesFilterSidebar.tsx)
// wraps a button around its own combobox input, which axe reports as `nested-interactive`.
// That file is outside this spec's ownership - reported to the coordinator instead of fixed
// here - so it is excluded from the scan rather than silently failing every run.
const FOLDER_PICKER_EXCLUDE = '[aria-label^="Select folder:"]';

// DashboardPicker (search/AlertRulesFilterSidebar.tsx) renders a react-select combobox with no
// accessible name of its own, which axe reports as `label`. Same as above: out of this spec's
// ownership, reported rather than fixed. Scoped to Select's generic container testid plus
// "missing an aria-label" so it only ever matches that specific violation, never a labelled
// combobox, and never something added later in this spec's own directories (none of which
// render a Select).
const DASHBOARD_PICKER_EXCLUDE = '[data-testid*="Select container"] input[role="combobox"]:not([aria-label])';

async function runA11yScan(
  page: Page,
  scanForA11yViolations: (context?: AxeScanContext) => Promise<AxeResults>,
  exclude?: string[]
) {
  await page.waitForTimeout(500); // let any open/close animation settle before scanning
  // A multi-element exclude array is treated by this axe-core/playwright version as a nested-
  // frame selector path, not as several independent exclusions - so multiple exclusions are
  // joined into one CSS selector list (comma-combinator) and passed as a single entry.
  const results = await scanForA11yViolations({
    options: { runOnly: { type: 'tag', values: DEFAULT_A11Y_TAGS } },
    ...(exclude ? { exclude: [exclude.join(', ')] } : {}),
  });
  expect(results).toHaveNoA11yViolations();
}

test.describe(
  'GMA rule list accessibility',
  {
    tag: ['@a11y'],
  },
  () => {
    test.slow();

    test('Alert rules: Folders mode with one folder expanded has no violations', async ({
      page,
      folder,
      alertRules,
      scanForA11yViolations,
    }) => {
      const title = 'High CPU usage';
      await alertRules.seedRule({ title, interval: '1m' });

      await gotoResilient(page, foldersModeUrl('alert', folder.uid));
      await expect(page.getByRole('button', { name: folder.title, expanded: false })).toBeVisible({
        timeout: 40_000,
      });
      await page.getByRole('button', { name: folder.title, expanded: false }).click();
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });

      await runA11yScan(page, scanForA11yViolations, [FOLDER_PICKER_EXCLUDE, DASHBOARD_PICKER_EXCLUDE]);
    });

    test('Alert rules: List mode has no violations', async ({ page, folder, alertRules, scanForA11yViolations }) => {
      const title = 'Memory pressure';
      await alertRules.seedRule({ title, interval: '1m' });

      await gotoResilient(page, listModeUrl('alert', folder.uid));
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });

      await runA11yScan(page, scanForA11yViolations, [FOLDER_PICKER_EXCLUDE, DASHBOARD_PICKER_EXCLUDE]);
    });

    test('Recording rules: Folders mode with one folder expanded has no violations', async ({
      page,
      folder,
      recordingRules,
      scanForA11yViolations,
    }) => {
      const title = 'cpu_usage:avg';
      await recordingRules.seedRule({ title, interval: '1m', metric: 'cpu_usage:avg' });

      await gotoResilient(page, foldersModeUrl('recording', folder.uid));
      await expect(page.getByRole('button', { name: folder.title, expanded: false })).toBeVisible({
        timeout: 40_000,
      });
      await page.getByRole('button', { name: folder.title, expanded: false }).click();
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });

      await runA11yScan(page, scanForA11yViolations, [FOLDER_PICKER_EXCLUDE]);
    });

    test('Recording rules: List mode has no violations', async ({
      page,
      folder,
      recordingRules,
      scanForA11yViolations,
    }) => {
      const title = 'mem_usage:avg';
      await recordingRules.seedRule({ title, interval: '1m', metric: 'mem_usage:avg' });

      await gotoResilient(page, listModeUrl('recording', folder.uid));
      await expect(page.getByRole('link', { name: title })).toBeVisible({ timeout: 40_000 });

      await runA11yScan(page, scanForA11yViolations, [FOLDER_PICKER_EXCLUDE]);
    });

    test('Alert rules: Recently deleted has no violations', async ({
      page,
      alertRules,
      scanForA11yViolations,
    }) => {
      const title = `Node load average ${crypto.randomUUID().slice(0, 8)}`;
      const uid = await alertRules.seedRule({ title, interval: '1m' });
      await page.request.delete(
        `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/alertrules/${encodeURIComponent(uid)}`
      );

      await gotoResilient(page, '/alerting/rules/alert/deleted');
      await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible({ timeout: 40_000 });

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Recording rules: Recently deleted has no violations', async ({
      page,
      recordingRules,
      scanForA11yViolations,
    }) => {
      const title = `Pod restart rate ${crypto.randomUUID().slice(0, 8)}`;
      const uid = await recordingRules.seedRule({ title, interval: '1m', metric: 'pod_restart:rate' });
      await page.request.delete(
        `/apis/rules.alerting.grafana.app/v0alpha1/namespaces/default/recordingrules/${encodeURIComponent(uid)}`
      );

      await gotoResilient(page, '/alerting/rules/recording/deleted');
      await expect(page.getByRole('cell', { name: title, exact: true })).toBeVisible({ timeout: 40_000 });

      await runA11yScan(page, scanForA11yViolations);
    });

    test('Alert rules: keyboard journey reaches the search input, sidebar, view toggle, folder expand, rule link and row menu; Escape returns focus to the trigger', async ({
      page,
      folder,
      alertRules,
    }) => {
      const title = 'Disk space low';
      await alertRules.seedRule({ title, interval: '1m' });

      await gotoResilient(page, foldersModeUrl('alert', folder.uid));

      const searchInput = page.getByRole('textbox', { name: 'Search' });
      await expect(searchInput).toBeVisible({ timeout: 40_000 });
      await searchInput.focus();
      await expect(searchInput).toBeFocused();

      // Folders/List toggle: both options keyboard-reachable with clear labels. It's a native
      // radio group, so ArrowRight moves between options - Tab moves past the whole group,
      // same as any other radiogroup - and getByRole with `name` already requires a real
      // accessible name, so a match here is itself the assertion.
      const foldersRadio = page.getByRole('radio', { name: 'Folders' });
      const listRadio = page.getByRole('radio', { name: 'List' });
      await expect(foldersRadio).toBeVisible();
      await expect(listRadio).toBeVisible();
      await foldersRadio.focus();
      await expect(foldersRadio).toBeFocused();
      await page.keyboard.press('ArrowRight');
      await expect(listRadio).toBeFocused();
      // A native radio group also selects on arrow-key movement, which just switched the page
      // to List mode - switch back so the folder-expand assertions below have something to
      // expand.
      await page.keyboard.press('ArrowLeft');
      await expect(foldersRadio).toBeFocused();
      await expect(foldersRadio).toBeChecked();

      // Folder expand control: Enter toggles aria-expanded, Space toggles it back. `exact`
      // matters here (rather than filtering on `expanded`, which would stop matching the
      // moment the value flips) - the sidebar's folder picker button's name also contains
      // folder.title as a substring ("Select folder: <title> currently selected"), so a
      // substring match would be ambiguous.
      const expandButton = page.getByRole('button', { name: folder.title, exact: true });
      await expect(expandButton).toBeVisible({ timeout: 40_000 });
      await expandButton.focus();
      await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press(' ');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'false');
      await page.keyboard.press('Enter');
      await expect(expandButton).toHaveAttribute('aria-expanded', 'true');

      // Rule title link and the row's More menu: both keyboard-operable, and Tab from the
      // link lands directly on its row's More button (confirms real DOM/tab order, not just
      // that the elements exist somewhere on the page).
      const ruleLink = page.getByRole('link', { name: title });
      await expect(ruleLink).toBeVisible({ timeout: 40_000 });
      const moreButton = ruleLink.locator('xpath=following::button[@aria-label="More"][1]');
      await ruleLink.focus();
      await expect(ruleLink).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(moreButton).toBeFocused();

      await page.keyboard.press('Enter');
      await expect(page.getByRole('menu')).toBeVisible();

      // Escape must close the menu and return focus to the button that opened it, not drop
      // focus to <body> - that's the part a screen-reader user actually depends on.
      await page.keyboard.press('Escape');
      await expect(page.getByRole('menu')).not.toBeVisible();
      await expect(moreButton).toBeFocused();
    });
  }
);
