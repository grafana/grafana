import test, { expect, type Locator } from '@playwright/test';

export async function expectPreviewOfValuesToBe(previewOptions: Locator, labels: string[]) {
  await test.step('Checking preview of values', async () => {
    await expect(previewOptions).toHaveCount(labels.length);
    for (let i = 0; i < labels.length; i++) {
      await expect(previewOptions.nth(i)).toHaveText(labels[i]);
    }
  });
}
