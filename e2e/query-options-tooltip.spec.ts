import { test, expect } from '@playwright/test';

const UI_SELECTORS = {
  // Navigation
  alertingMenuItem: '[data-testid="nav-alerting"]',
  alertRulesTab: '[data-testid="alert-rules-tab"]',
  newRuleButton: '[data-testid="new-rule-button"]',
  
  // Query editor
  datasourceSelect: '[data-testid="datasource-picker"]',
  queryEditor: '[data-testid="query-editor"]',
  optionsButton: 'button:has-text("Options")',
  
  // Query options tooltip
  optionsTooltip: '[data-testid="toggletip-content"]',
  maxDataPointsInput: 'input[placeholder*="Max data points"], input[value*="data points"]',
  minIntervalInput: 'input[placeholder*="interval"], input[value*="interval"]',
  tooltipCloseButton: '[data-testid="toggletip-header-close"]',
  
  // Static values display
  staticValues: '[class*="staticValues"]',
} as const;

test.describe('Query Options Tooltip Data Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to new alert rule creation
    await page.goto('/alerting/new');
    
    // Wait for page to load
    await page.waitForSelector(UI_SELECTORS.queryEditor, { timeout: 10000 });
  });

  test('should preserve max data points value when clicking outside tooltip', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Find and fill max data points input
    const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await maxDataPointsInput.fill('200');

    // Click outside the tooltip to close it
    await page.click('body', { position: { x: 100, y: 100 } });

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify the value appears in static display
    await expect(page.locator('text=/MD = 200/')).toBeVisible();

    // Re-open tooltip to verify value persisted
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const reopenedInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await expect(reopenedInput).toHaveValue('200');
  });

  test('should preserve min interval value when clicking outside tooltip', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Find and fill min interval input
    const minIntervalInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    await minIntervalInput.fill('30s');

    // Click outside the tooltip to close it
    await page.click('body', { position: { x: 100, y: 100 } });

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify the value appears in static display
    await expect(page.locator('text=/Min\\. Interval = 30s/')).toBeVisible();

    // Re-open tooltip to verify value persisted
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const reopenedInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    await expect(reopenedInput).toHaveValue('30s');
  });

  test('should preserve both values when both are changed and tooltip is closed', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Fill both inputs
    const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    const minIntervalInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    
    await maxDataPointsInput.fill('500');
    await minIntervalInput.fill('15s');

    // Click outside the tooltip to close it
    await page.click('body', { position: { x: 100, y: 100 } });

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify both values appear in static display
    await expect(page.locator('text=/MD = 500/')).toBeVisible();
    await expect(page.locator('text=/Min\\. Interval = 15s/')).toBeVisible();

    // Re-open tooltip to verify both values persisted
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const reopenedMaxInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    const reopenedMinInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    
    await expect(reopenedMaxInput).toHaveValue('500');
    await expect(reopenedMinInput).toHaveValue('15s');
  });

  test('should preserve values when tooltip is closed with Escape key', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Fill max data points input
    const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await maxDataPointsInput.fill('300');

    // Close tooltip with Escape key
    await page.keyboard.press('Escape');

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify the value appears in static display
    await expect(page.locator('text=/MD = 300/')).toBeVisible();

    // Re-open tooltip to verify value persisted
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const reopenedInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await expect(reopenedInput).toHaveValue('300');
  });

  test('should preserve values when tooltip is closed with close button', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Fill min interval input
    const minIntervalInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    await minIntervalInput.fill('45s');

    // Close tooltip with close button (if available)
    const closeButton = page.locator(UI_SELECTORS.tooltipCloseButton);
    if (await closeButton.isVisible()) {
      await closeButton.click();
    } else {
      // Fallback to clicking outside if no close button
      await page.click('body', { position: { x: 100, y: 100 } });
    }

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify the value appears in static display
    await expect(page.locator('text=/Min\\. Interval = 45s/')).toBeVisible();

    // Re-open tooltip to verify value persisted
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const reopenedInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    await expect(reopenedInput).toHaveValue('45s');
  });

  test('should handle empty values correctly when tooltip closes', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Clear max data points input (make it empty)
    const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await maxDataPointsInput.fill('');

    // Click outside to close tooltip
    await page.click('body', { position: { x: 100, y: 100 } });

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify max data points is not displayed in static values (since it's empty)
    await expect(page.locator('text=/MD = /')).not.toBeVisible();

    // Re-open tooltip to verify value remained empty
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const reopenedInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await expect(reopenedInput).toHaveValue('');
  });

  test('should handle zero value correctly for max data points', async ({ page }) => {
    // Open the options tooltip
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Set max data points to zero
    const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await maxDataPointsInput.fill('0');

    // Click outside to close tooltip
    await page.click('body', { position: { x: 100, y: 100 } });

    // Wait for tooltip to close
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Zero should be treated as undefined, so no static display
    await expect(page.locator('text=/MD = 0/')).not.toBeVisible();
    await expect(page.locator('text=/MD = /')).not.toBeVisible();
  });

  test('should not lose data during rapid open/close cycles', async ({ page }) => {
    // Test rapid open/close to ensure no race conditions
    for (let i = 0; i < 3; i++) {
      // Open tooltip
      await page.click(UI_SELECTORS.optionsButton);
      await page.waitForSelector(UI_SELECTORS.optionsTooltip);

      // Quickly change value
      const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
      await maxDataPointsInput.fill(`${100 + i * 50}`);

      // Close quickly
      await page.click('body', { position: { x: 100, y: 100 } });
      await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

      // Verify value persisted
      await expect(page.locator(`text=/MD = ${100 + i * 50}/`)).toBeVisible();
    }

    // Final verification - the last value should still be there
    await page.click(UI_SELECTORS.optionsButton);
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);
    
    const finalInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await expect(finalInput).toHaveValue('200'); // 100 + 2 * 50
  });

  test('should work correctly with keyboard navigation', async ({ page }) => {
    // Open tooltip with keyboard
    await page.focus(UI_SELECTORS.optionsButton);
    await page.keyboard.press('Enter');
    await page.waitForSelector(UI_SELECTORS.optionsTooltip);

    // Navigate to max data points input with Tab
    await page.keyboard.press('Tab');
    const maxDataPointsInput = page.locator(UI_SELECTORS.maxDataPointsInput).first();
    await expect(maxDataPointsInput).toBeFocused();

    // Type value
    await maxDataPointsInput.fill('600');

    // Tab to min interval input
    await page.keyboard.press('Tab');
    const minIntervalInput = page.locator(UI_SELECTORS.minIntervalInput).first();
    await expect(minIntervalInput).toBeFocused();

    // Type value
    await minIntervalInput.fill('20s');

    // Close with Escape
    await page.keyboard.press('Escape');
    await page.waitForSelector(UI_SELECTORS.optionsTooltip, { state: 'hidden' });

    // Verify both values persisted
    await expect(page.locator('text=/MD = 600/')).toBeVisible();
    await expect(page.locator('text=/Min\\. Interval = 20s/')).toBeVisible();
  });
});