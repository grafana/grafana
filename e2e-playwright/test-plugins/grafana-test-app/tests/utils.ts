import { type APIRequestContext, type Locator, type Page } from '@playwright/test';

import { expect } from '@grafana/plugin-e2e';

type WritePath = 'legacy' | 'mt';

function isLegacyWrite(method: string, url: string, pluginId: string): boolean {
  return method === 'POST' && url.includes(`/api/plugins/${pluginId}/settings`);
}

function isMtWrite(method: string, url: string, pluginId: string): boolean {
  return method === 'PATCH' && url.includes(`/apis/${pluginId}/`) && url.includes('/app/instance');
}

// Clicks Enable/Disable and asserts the write succeeded via `expected`. Waits for either path (so a
// silent fallback fails clearly, not by timeout), registered before the click since success reloads.
async function clickAndAssertWrite(page: Page, button: Locator, pluginId: string, expected: WritePath): Promise<void> {
  const responsePromise = page.waitForResponse((res) => {
    const method = res.request().method();
    const url = res.url();
    return isLegacyWrite(method, url, pluginId) || isMtWrite(method, url, pluginId);
  });

  await button.click();

  const response = await responsePromise;
  const method = response.request().method();
  const url = response.url();

  expect(response.ok(), `settings write ${method} ${url} returned ${response.status()}`).toBeTruthy();

  const actual: WritePath = isMtWrite(method, url, pluginId) ? 'mt' : 'legacy';
  expect(actual, `expected the ${expected} settings path but the write went via ${actual} (${method} ${url})`).toBe(
    expected
  );
}

// Drives the disable -> enable round-trip, asserting each write routes through `expected` and the
// reloaded page reflects the new state (button flip).
export async function assertEnableDisableRoundtrip(page: Page, pluginId: string, expected: WritePath): Promise<void> {
  await page.goto(`/plugins/${pluginId}`);

  const disableButton = page.getByRole('button', { name: 'Disable', exact: true });
  const enableButton = page.getByRole('button', { name: 'Enable', exact: true });

  // Provisioned disabled:false -> enabled -> Disable is the available action.
  await expect(disableButton).toBeVisible();

  await clickAndAssertWrite(page, disableButton, pluginId, expected);
  await expect(enableButton).toBeVisible();

  await clickAndAssertWrite(page, enableButton, pluginId, expected);
  await expect(disableButton).toBeVisible();
}

// afterEach safety net so a mid-test failure can't leave the fixture disabled. Legacy endpoint is
// correct for both flag combos today (MT settings share the same SQL store); revisit if it moves.
export async function restoreAppPluginEnabled(request: APIRequestContext, pluginId: string): Promise<void> {
  const response = await request.post(`/api/plugins/${pluginId}/settings`, {
    data: { enabled: true, pinned: true },
  });
  expect(response.ok(), `failed to restore ${pluginId} enabled state`).toBeTruthy();
}
