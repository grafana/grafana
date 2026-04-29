import { test, expect } from '@grafana/plugin-e2e';

import { applyScopes, openScopesSelector, selectScope, setupScopeRoutes } from '../utils/scope-helpers';
import { testScopesWithRedirect } from '../utils/scopes';

test.use({
  featureToggles: {
    scopeFilters: true,
    groupByVariable: true,
    reloadDashboardsOnParamsChange: true,
    useScopesNavigationEndpoint: true,
    dashboardNewLayouts: false,
  },
});

test.describe('Scope Redirect Functionality', () => {
  test('should redirect to custom URL when scope has redirectUrl', async ({ page, gotoDashboardPage }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Set up routes and navigate to dashboard', async () => {
      // Set up routes BEFORE navigation to ensure all requests are mocked
      await setupScopeRoutes(page, scopes);
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
    });

    await test.step('Open scopes selector', async () => {
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

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
    });

    await test.step('Open scopes selector', async () => {
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

  test('should not redirect when reloading page on dashboard not in dashboard list', async ({
    page,
    gotoDashboardPage,
  }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
    });

    await test.step('Select and apply scope', async () => {
      await openScopesSelector(page, scopes);
      await selectScope(page, 'sn-redirect-fallback', scopes[1]);
      await applyScopes(page, [scopes[1]]);

      // Verify the scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });

    await test.step('Navigate to dashboard not in scope dashboard list', async () => {
      // Navigate to a dashboard that is not in the scope dashboard bindings
      // Preserve the scope parameter using queryParams
      await gotoDashboardPage({
        uid: 'cuj-dashboard-3',
        queryParams: new URLSearchParams({ scopes: 'scope-sn-redirect-fallback' }),
      });

      // Verify we're on cuj-dashboard-3 with the scope still applied
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-3/);
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });

    await test.step('Reload page and verify no redirect', async () => {
      // Reload the page with the scope still selected
      await page.reload();

      // Wait for the page to load
      await page.waitForLoadState('networkidle');

      // Should stay on the same dashboard (cuj-dashboard-3), not redirect
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-3/);

      // Verify the scope is still applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });
  });

  test('should not redirect when deselecting scopes on dashboard not in dashboard list', async ({
    page,
    gotoDashboardPage,
  }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
    });

    await test.step('Select and apply scope', async () => {
      await openScopesSelector(page, scopes);
      await selectScope(page, 'sn-redirect-fallback', scopes[1]);
      await applyScopes(page, [scopes[1]]);

      // Verify the scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });

    await test.step('Navigate to dashboard not in scope dashboard list', async () => {
      // Navigate to a dashboard that is not in the scope dashboard bindings
      // Preserve the scope parameter using queryParams
      await gotoDashboardPage({
        uid: 'cuj-dashboard-3',
        queryParams: new URLSearchParams({ scopes: 'scope-sn-redirect-fallback' }),
      });

      // Verify we're on cuj-dashboard-3 with the scope still applied
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-3/);
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });

    await test.step('Deselect scopes and verify no redirect', async () => {
      // Click the clear button to remove all scopes
      await page.getByTestId('scopes-selector-input').hover();
      await page.getByTestId('scopes-selector-input-clear').click();

      // Should stay on the same dashboard (cuj-dashboard-3), not redirect
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-3/);

      // Verify the scope is no longer in the URL
      await expect(page).not.toHaveURL(/scopes=/);
    });
  });

  test('should not redirect to redirectPath when on active scope navigation', async ({ page, gotoDashboardPage }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      await gotoDashboardPage({ uid: 'cuj-dashboard-1' });
    });

    await test.step('Set up scope navigation to dashboard-1', async () => {
      // First, apply a scope that creates scope navigation to dashboard-1 (without redirectPath)
      await openScopesSelector(page, scopes);
      await selectScope(page, 'sn-redirect-setup', scopes[2]);
      await applyScopes(page, [scopes[2]]);

      // Verify we're on dashboard-1 with the scope applied
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-1/);
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-setup/);
    });

    await test.step('Navigate to dashboard-1 to be on active scope navigation', async () => {
      // Navigate to dashboard-1 which is now a scope navigation target
      await gotoDashboardPage({
        uid: 'cuj-dashboard-1',
        queryParams: new URLSearchParams({ scopes: 'scope-sn-redirect-setup' }),
      });

      // Verify we're on dashboard-1
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-1/);
    });

    await test.step('Apply scope with redirectPath and verify no redirect', async () => {
      // Now apply a different scope that has redirectPath
      // Since we're on an active scope navigation, it should NOT redirect
      await openScopesSelector(page, scopes);
      await selectScope(page, 'sn-redirect-with-navigation', scopes[3]);
      await applyScopes(page, [scopes[3]]);

      // Verify the new scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-with-navigation/);

      // Since we're already on the active scope navigation (dashboard-1),
      // we should NOT redirect to redirectPath (dashboard-3)
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-1/);
      await expect(page).not.toHaveURL(/\/d\/cuj-dashboard-3/);
    });
  });

  test('should redirect to related dashboard when changing scopes (NOT in edit mode)', async ({
    page,
    gotoDashboardPage,
  }) => {
    const scopes = testScopesWithRedirect();

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      await gotoDashboardPage({ uid: 'cuj-dashboard-3' });
    });

    await test.step('Select and apply scope with related dashboard', async () => {
      await openScopesSelector(page, scopes);
      await selectScope(page, 'sn-redirect-fallback', scopes[1]);
      await applyScopes(page, [scopes[1]]);

      // Should redirect from cuj-dashboard-3 to cuj-dashboard-2 (the related dashboard)
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-2/);
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });
  });

  test('should not redirect when changing scopes while editing a dashboard', async ({
    page,
    gotoDashboardPage,
    selectors,
  }) => {
    const scopes = testScopesWithRedirect();
    let dashboardPage: Awaited<ReturnType<typeof gotoDashboardPage>>;

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      dashboardPage = await gotoDashboardPage({ uid: 'cuj-dashboard-3' });
    });

    await test.step('Enter edit mode', async () => {
      // Click the edit button to enter edit mode
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Wait for edit mode to be active by checking for the Save button
      const saveButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton);
      await expect(saveButton).toBeVisible();
    });

    await test.step('Change scope while in edit mode and verify no redirect', async () => {
      // Select and apply a scope that would normally trigger a redirect
      await openScopesSelector(page, scopes);
      expect(page.getByText('Select scopes')).toBeVisible();
      await selectScope(page, 'sn-redirect-fallback', scopes[1]);
      await applyScopes(page, [scopes[1]]);

      // Verify the scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);

      // Should stay on the same dashboard (cuj-dashboard-3) even though we're not on a related dashboard
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-3/);

      // Should still be in edit mode (Save button is still visible)
      const saveButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton);
      await expect(saveButton).toBeVisible();
    });
  });

  test('should redirect again after exiting edit mode', async ({ page, gotoDashboardPage, selectors }) => {
    const scopes = testScopesWithRedirect();
    let dashboardPage: Awaited<ReturnType<typeof gotoDashboardPage>>;

    await test.step('Set up routes and navigate to dashboard', async () => {
      await setupScopeRoutes(page, scopes);
      dashboardPage = await gotoDashboardPage({ uid: 'cuj-dashboard-3' });
    });

    await test.step('Enter edit mode', async () => {
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton).click();

      // Wait for edit mode to be active by checking for the Save button
      const saveButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.saveButton);
      await expect(saveButton).toBeVisible();
    });

    await test.step('Change scope while in edit mode and verify no redirect', async () => {
      await openScopesSelector(page, scopes);
      await selectScope(page, 'sn-redirect-fallback', scopes[1]);
      await applyScopes(page, [scopes[1]]);

      // Verify the scope was applied
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);

      // Should stay on cuj-dashboard-3 — redirect is disabled in edit mode
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-3/);
    });

    await test.step('Exit edit mode', async () => {
      // Click the "Exit edit" button — the dashboard is dirty so confirmation dialog will appear.
      await dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.exitButton).click();

      // Entering edit mode can apply auto-changes (e.g. schema migration) that
      // mark the dashboard dirty, so the discard confirmation may appear.
      await dashboardPage.getByGrafanaSelector(selectors.pages.ConfirmModal.delete).click();

      const editButton = dashboardPage.getByGrafanaSelector(selectors.components.NavToolbar.editDashboard.editButton);
      await expect(editButton).toBeVisible();
    });

    await test.step('Clear scope and re-apply to verify redirect is re-enabled', async () => {
      // Clear all scopes first (removeAllScopes — redirectOnApply=false, so no redirect here)
      await page.getByTestId('scopes-selector-input').hover();
      await page.getByTestId('scopes-selector-input-clear').click();

      // Verify scope was cleared from URL
      await expect(page).not.toHaveURL(/scopes=/);

      // Re-apply the same scope — now that edit mode is off, redirect should fire.
      // Skip waiting for all network responses: the tree, scope data, and dashboard
      // bindings/navigations are all either cached or cancelled by the redirect navigation
      // itself. The routes from the first apply are still registered so mocks still work.
      await openScopesSelector(page);
      await selectScope(page, 'sn-redirect-fallback');
      await applyScopes(page);

      // Should now redirect from cuj-dashboard-3 to cuj-dashboard-2
      await expect(page).toHaveURL(/\/d\/cuj-dashboard-2/);
      await expect(page).toHaveURL(/scopes=scope-sn-redirect-fallback/);
    });
  });
});
