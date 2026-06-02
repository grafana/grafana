import { expect, type Locator, type Page, test } from 'playwright/test';

const LAST_OPTION_LABEL = 'Option 999999';

test.describe(
  'Combobox virtual scrolling',
  {
    tag: ['@storybook'],
  },
  () => {
    test.describe.configure({ mode: 'serial' });

    test('Combobox can reach and select the last item in a 1,000,000 option list', async ({ page }) => {
      await openStory(page, 'inputs-combobox--virtual-scroll-regression');
      await openCombobox(page);

      const lastOption = await scrollToLastOption(page);
      await lastOption.click();

      await expect(page.getByRole('combobox')).toHaveValue(LAST_OPTION_LABEL);
    });

    test('Combobox can reach the last item when large options have mixed row heights', async ({ page }) => {
      await openStory(page, 'inputs-combobox--virtual-scroll-regression-mixed-heights');
      await openCombobox(page);

      await expect(await scrollToLastOption(page)).toBeVisible();
    });

    test('MultiCombobox can reach and select the last item in a 1,000,000 option list', async ({ page }) => {
      await openStory(page, 'inputs-multicombobox--virtual-scroll-regression');
      await openCombobox(page);

      const lastOption = await scrollToLastOption(page);
      await lastOption.click();

      await expect(page.getByRole('button', { name: `Remove ${LAST_OPTION_LABEL}` })).toBeVisible();
    });

    test('MultiCombobox can reach the last item when large options have group headers', async ({ page }) => {
      await openStory(page, 'inputs-multicombobox--virtual-scroll-regression-grouped');
      await openCombobox(page);

      await expect(await scrollToLastOption(page)).toBeVisible();
    });
  }
);

async function openStory(page: Page, storyId: string) {
  await page.routeWebSocket(/storybook-server-channel/, () => {});
  await page.goto(`/iframe.html?id=${storyId}&viewMode=story`);
  await expect(page.getByRole('combobox')).toBeVisible();
}

async function openCombobox(page: Page) {
  await page.getByRole('combobox').click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(page.getByRole('option', { name: /Option 5/ })).toBeVisible({ timeout: 30_000 });
}

async function scrollToLastOption(page: Page): Promise<Locator> {
  const scroller = page.getByRole('listbox').locator('div[tabindex="0"]').first();
  await expect(scroller).toBeVisible();

  await scroller.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });

  const lastOption = page.getByRole('option', { name: LAST_OPTION_LABEL });
  await expect(lastOption).toBeVisible({ timeout: 10_000 });

  return lastOption;
}
