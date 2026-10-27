import { test, expect } from '@playwright/test';

test.describe('Combobox initial scrolling', () => {
  for (const { story, value, label } of [
    { story: 'basic', value: 'banana', label: 'Banana' },
    { story: 'basic', value: 'jackfruit', label: 'Jackfruit' },
    { story: 'custom-option-rendering', value: 'service-35', label: 'Service 35' },
  ]) {
    test(`keeps ${label} visible on first open and reopen`, async ({ page }) => {
      await page.goto(`/iframe.html?id=inputs-combobox--${story}&viewMode=story&args=value:${value}`);
      const input = page.getByRole('combobox');
      const selectedOption = page.getByRole('option', { name: new RegExp(`^${label}`) });

      await input.click();
      await expect(selectedOption).toBeInViewport({ ratio: 1 });

      await input.press('Escape');
      await expect(page.getByRole('listbox')).toBeHidden();
      await input.click();
      await expect(selectedOption).toBeInViewport({ ratio: 1 });
    });
  }
});
