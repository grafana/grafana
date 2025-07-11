import { test, expect } from '@grafana/plugin-e2e';

const DASHBOARD_UID = 'HYaGDGIMk';

test.use({
  timezoneId: 'Pacific/Easter',
});

test.describe(
  'Dashboard templating',
  {
    tag: ['@dashboards'],
  },
  () => {
    test('Verify variable interpolation works', async ({ page, gotoDashboardPage }) => {
      // Open dashboard global variables and interpolation
      await gotoDashboardPage({ uid: DASHBOARD_UID });

      // Get the actual timezone from the browser context (should be Pacific/Easter due to test.use)
      const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
      const example = `Example: from=now-6h&to=now&timezone=${encodeURIComponent(timeZone)}`;

      const expectedItems: string[] = [
        '__dashboard = Templating - Global variables and interpolation',
        '__dashboard.name = Templating - Global variables and interpolation',
        '__dashboard.uid = HYaGDGIMk',
        '__org.name = Main Org.',
        '__org.id = 1',
        '__user.id = 1',
        '__user.login = admin',
        '__user.email = admin@localhost',
        `Server:raw = A'A"A,BB\\B,CCC`,
        `Server:regex = (A'A"A|BB\\\\B|CCC)`,
        `Server:lucene = ("A'A\\"A" OR "BB\\\\B" OR "CCC")`,
        `Server:glob = {A'A"A,BB\\B,CCC}`,
        `Server:pipe = A'A"A|BB\\B|CCC`,
        `Server:distributed = A'A"A,Server=BB\\B,Server=CCC`,
        `Server:csv = A'A"A,BB\\B,CCC`,
        `Server:html = A&#39;A&quot;A, BB\\B, CCC`,
        `Server:json = ["A'A\\"A","BB\\\\B","CCC"]`,
        `Server:percentencode = %7BA%27A%22A%2CBB%5CB%2CCCC%7D`,
        `Server:singlequote = 'A\\'A"A','BB\\B','CCC'`,
        `Server:doublequote = "A'A\\"A","BB\\B","CCC"`,
        `Server:sqlstring = 'A''A\\"A','BB\\\B','CCC'`,
        `Server:date = NaN`,
        `Server:text = All`,
        `Server:queryparam = var-Server=$__all`,
        `1 < 2`,
        example,
      ];

      // Get all list items from the markdown content
      const listItems = page.locator('.markdown-html li');

      // Verify we have the expected number of items
      await expect(listItems).toHaveCount(26);

      // Get all the text content from list items
      const actualItems = await listItems.allTextContents();

      // Compare each expected item with actual items
      for (let i = 0; i < expectedItems.length; i++) {
        expect(actualItems[i]).toBe(expectedItems[i]);
      }

      // Check link interpolation is working correctly
      const exampleLink = page.locator(`a:has-text("${example}")`);
      await expect(exampleLink).toHaveAttribute(
        'href',
        `https://example.com/?from=now-6h&to=now&timezone=${encodeURIComponent(timeZone)}`
      );
    });
  }
);
