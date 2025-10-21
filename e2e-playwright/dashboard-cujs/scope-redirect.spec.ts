import { test, expect } from '@grafana/plugin-e2e';
import { applyScopes, openScopesSelector, selectScope } from '../utils/scope-helpers';
import { testScopesWithRedirect } from '../utils/scopes';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
  },
});

test.describe('Scope Redirect Functionality', () => {
  test('should redirect to custom URL when scope has redirectUrl', async ({ page, gotoDashboardPage }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Navigate to dashboard and open scopes selector', async () => {
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
      await openScopesSelector(page, scopes);
    });

    await test.step('Select scope with redirectUrl', async () => {
      // Select the scope with redirectUrl directly
      await selectScope(page, 'sn-redirect-custom', scopes[0]);
    });

    await test.step('Apply scopes and verify redirect to custom URL', async () => {
      await applyScopes(page, [scopes[0]]);

      // Verify we were redirected to the custom URL
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-2/);

      // Also verify the scope was applied by checking the URL contains the scope
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-custom/);
    });
  });

  test('should prioritize redirectUrl over scope navigation fallback', async ({ page, gotoDashboardPage }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Navigate to dashboard and open scopes selector', async () => {
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
      await openScopesSelector(page, scopes);
    });

    await test.step('Select scope with redirectUrl', async () => {
      // Select the scope with redirectUrl directly
      await selectScope(page, 'sn-redirect-custom', scopes[0]);
    });

    await test.step('Apply scopes and verify redirectUrl takes priority', async () => {
      await applyScopes(page, [scopes[0]]);

      // Should redirect to custom URL, not stay on current dashboard
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-2/);
      await expect(page).not.toHaveURL(/\/d\/cuj-dashboard-1/);

      // Verify the scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-custom/);
    });
  });

  test('should fall back to scope navigation when no redirectUrl', async ({ page, gotoDashboardPage }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Navigate to dashboard and open scopes selector', async () => {
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
      await openScopesSelector(page, scopes);
    });

    await test.step('Select scope without redirectUrl', async () => {
      // Select the scope without redirectUrl directly
      await selectScope(page, 'sn-redirect-fallback', scopes[1]);
    });

    await test.step('Apply scopes and verify fallback behavior', async () => {
      await applyScopes(page, [scopes[1]]);

      // Should stay on current dashboard since no redirectUrl is provided
      // The scope navigation fallback should not redirect (as per existing behavior)
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-1/);

      // Verify the scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });
  });
});
