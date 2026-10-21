import { test, expect } from './fixtures';
import { RuleListPage, type RuleListKind, expectHref, folderScope, linkTarget } from './pages/RuleListPage';

// Requires alerting.rulesAPIV2 so the editor opens ungrouped rules; exact paths prove no `returnTo`.
test.use({
  featureToggles: {
    'alerting.rulesAPIV2': true,
  },
});

interface ListPageCase {
  kind: RuleListKind;
  ruleTitle: string;
  newRuleLabel: string;
  newRulePath: string;
}

const listPages: ListPageCase[] = [
  {
    kind: 'alert',
    ruleTitle: 'High CPU usage',
    newRuleLabel: 'New alert rule',
    newRulePath: '/alerting/new/alerting',
  },
  {
    kind: 'recording',
    ruleTitle: 'cpu_usage:avg',
    newRuleLabel: 'New recording rule',
    newRulePath: '/alerting/new/grafana-recording',
  },
];

for (const { kind, ruleTitle, newRuleLabel, newRulePath } of listPages) {
  test.describe(`${kind === 'alert' ? 'Alert' : 'Recording'} rule links`, () => {
    test(`${newRuleLabel} opens the creation form without returnTo`, async ({ page, folder }) => {
      const list = new RuleListPage(page, kind);
      await list.goto(folderScope(folder.uid));

      await expectHref(list.newRuleLink, newRulePath);
      await list.newRuleLink.click();
      await expect(page).toHaveURL(new RegExp(`${newRulePath}(\\?.*)?$`));
    });

    test(`the header offers only the actions of ${kind} rules`, async ({ page, folder }) => {
      const list = new RuleListPage(page, kind);
      await list.goto(folderScope(folder.uid));
      await expect(list.newRuleLink).toBeVisible();

      const headerMenu = page.getByRole('button', { name: 'More', exact: true });
      if (kind === 'alert') {
        await headerMenu.click();
        await expect(page.getByRole('menuitem')).toHaveText(['Design rule for provisioning']);
        await expectHref(
          page.getByRole('menuitem', { name: 'Design rule for provisioning' }),
          '/alerting/export-new-rule'
        );
        await page.keyboard.press('Escape');
        await expect(page.getByRole('link', { name: 'New recording rule' })).toHaveCount(0);
      } else {
        await expect(headerMenu).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'New alert rule' })).toHaveCount(0);
      }
    });

    test(`a row's View, Edit and Duplicate links carry no returnTo`, async ({
      page,
      folder,
      alertRules,
      recordingRules,
    }) => {
      const uid =
        kind === 'alert'
          ? await alertRules.seedRule({ title: ruleTitle, interval: '1m' })
          : await recordingRules.seedRule({ title: ruleTitle, interval: '1m', metric: 'cpu_usage:avg' });

      const list = new RuleListPage(page, kind);
      await list.goto(folderScope(folder.uid));

      await expectHref(list.ruleLink(ruleTitle), `/alerting/grafana/${uid}/view`);
      await expectHref(list.editLink(ruleTitle), `/alerting/${uid}/edit`);

      await list.openRowMenu(ruleTitle);
      await expectHref(
        page.getByRole('menuitem', { name: 'Duplicate', exact: true }),
        kind === 'alert' ? '/alerting/new' : '/alerting/new/grafana-recording',
        { copyFrom: uid }
      );
    });

    test(`Edit opens the editor by UID and Copy link copies the rule's canonical URL`, async ({
      page,
      folder,
      alertRules,
      recordingRules,
    }) => {
      await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
      const uid =
        kind === 'alert'
          ? await alertRules.seedRule({ title: ruleTitle, interval: '1m' })
          : await recordingRules.seedRule({ title: ruleTitle, interval: '1m', metric: 'cpu_usage:avg' });

      const list = new RuleListPage(page, kind);
      await list.goto(folderScope(folder.uid));

      await list.openRowMenu(ruleTitle);
      await page.getByRole('menuitem', { name: 'Copy link', exact: true }).click();
      await expect(page.getByText('URL copied to clipboard')).toBeVisible();

      const copied = new URL(await page.evaluate(() => navigator.clipboard.readText()));
      expect(linkTarget(copied.pathname + copied.search)).toEqual({
        path: `/alerting/grafana/${uid}/view`,
        params: {},
      });

      await list.editLink(ruleTitle).click();
      await expect(page).toHaveURL(new RegExp(`/alerting/${uid}/edit(\\?orgId=\\d+)?$`));
    });
  });
}
