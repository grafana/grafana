import config from 'app/core/config';

import { getAppRoutes } from './routes';

// getAppRoutes pulls in the live redux store and plugin manifest in
// order to compose plugin-provided routes. Neither is set up in the
// jest environment, so we stub the helpers that touch them — we only
// care about the toggle-gated branches in this suite, not the
// upstream route lists.
jest.mock('app/features/plugins/routes', () => ({
  getAppPluginRoutes: () => [] as never[],
}));
jest.mock('app/features/alerting/routes', () => ({
  getAlertingRoutes: () => [] as never[],
}));
jest.mock('app/features/connections/routes', () => ({
  getRoutes: () => [] as never[],
}));
jest.mock('app/features/profile/routes', () => ({
  getProfileRoutes: () => [] as never[],
}));
jest.mock('app/features/plugins/admin/routes', () => ({
  getRoutes: () => [] as never[],
}));
jest.mock('../features/provisioning/utils/routes', () => ({
  getProvisioningRoutes: () => [] as never[],
}));
jest.mock('../features/dashboard/routes', () => ({
  getPublicDashboardRoutes: () => [] as never[],
}));

// Spot-check coverage for feature-toggle-gated routes: each conditional
// short-circuit in getAppRoutes contributes a branch to the coverage
// report, so we exercise both polarities to keep the navigation
// codeowner's coverage stable as new toggle-gated routes are added.
describe('getAppRoutes feature toggle gating', () => {
  // Snapshot the live featureToggles map so toggling values per-test
  // doesn't bleed into other suites that read config.featureToggles.
  const originalToggles = { ...config.featureToggles };

  afterEach(() => {
    config.featureToggles = { ...originalToggles };
  });

  describe('dashboardPulse', () => {
    it('exposes /pulse when the toggle is on', () => {
      config.featureToggles = { ...originalToggles, dashboardPulse: true };
      const routes = getAppRoutes();
      expect(routes.some((r) => r.path === '/pulse')).toBe(true);
    });

    it('omits /pulse when the toggle is off', () => {
      config.featureToggles = { ...originalToggles, dashboardPulse: false };
      const routes = getAppRoutes();
      expect(routes.some((r) => r.path === '/pulse')).toBe(false);
    });
  });
});
