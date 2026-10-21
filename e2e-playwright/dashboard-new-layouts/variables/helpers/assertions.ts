import test, { expect, type Locator } from '@playwright/test';

export async function expectPreviewOfValuesToBe(previewOptions: Locator, labels: string[]) {
  await test.step('Checking preview of values', async () => {
    if (labels.length > 0) {
      // the first options may come from a data source query, which can take a while to load
      await expect(previewOptions.first()).toBeVisible({ timeout: 15_000 });
    }

    await expect(previewOptions).toHaveCount(labels.length);

    for (let i = 0; i < labels.length; i++) {
      await expect(previewOptions.nth(i)).toHaveText(labels[i]);
    }
  });
}
