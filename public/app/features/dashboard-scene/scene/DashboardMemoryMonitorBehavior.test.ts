/**
 * Integration tests for DashboardMemoryMonitorBehavior
 * These tests avoid complex scene mocking and test the factory functions
 */

import { config } from '@grafana/runtime';

describe('DashboardMemoryMonitorBehavior Integration Tests', () => {
  beforeEach(() => {
    // Reset config between tests
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = ['*'];
  });

  it('should import and create behavior successfully', async () => {
    const { createDashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');
    const behavior = createDashboardMemoryMonitorBehavior('test-dashboard');
    expect(behavior).toBeDefined();
    expect(behavior.state.enabled).toBe(true);
  });

  it('should create enabled behavior for wildcard configuration', async () => {
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = ['*'];

    const { createDashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');
    const behavior = createDashboardMemoryMonitorBehavior('any-dashboard-uid');

    expect(behavior.state.enabled).toBe(true);
  });

  it('should create enabled behavior for specifically configured dashboard', async () => {
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = [
      'specific-dashboard-uid',
    ];

    const { createDashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');
    const behavior = createDashboardMemoryMonitorBehavior('specific-dashboard-uid');

    expect(behavior.state.enabled).toBe(true);
  });

  it('should create disabled behavior for non-configured dashboard', async () => {
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = ['other-dashboard-uid'];

    const { createDashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');
    const behavior = createDashboardMemoryMonitorBehavior('test-dashboard-uid');

    expect(behavior.state.enabled).toBe(false);
  });

  it('should create disabled behavior when configuration is empty', async () => {
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = [];

    const { createDashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');
    const behavior = createDashboardMemoryMonitorBehavior('test-dashboard-uid');

    expect(behavior.state.enabled).toBe(false);
  });

  it('should create disabled behavior when configuration is undefined', async () => {
    (config as unknown as { dashboardMemoryMonitoring: string[] | undefined }).dashboardMemoryMonitoring = undefined;

    const { createDashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');
    const behavior = createDashboardMemoryMonitorBehavior('test-dashboard-uid');

    expect(behavior.state.enabled).toBe(false);
  });

  it('should create behavior with constructor', async () => {
    const { DashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');

    const enabledBehavior = new DashboardMemoryMonitorBehavior({ enabled: true });
    expect(enabledBehavior.state.enabled).toBe(true);

    const disabledBehavior = new DashboardMemoryMonitorBehavior({ enabled: false });
    expect(disabledBehavior.state.enabled).toBe(false);
  });

  it('should handle getDashboardUid with no parent', async () => {
    const { DashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');

    const behavior = new DashboardMemoryMonitorBehavior({ enabled: true });
    const uid = behavior['getDashboardUid']();

    expect(uid).toBeUndefined();
  });

  it('should handle getDashboardTitle with no parent', async () => {
    const { DashboardMemoryMonitorBehavior } = await import('./DashboardMemoryMonitorBehavior');

    const behavior = new DashboardMemoryMonitorBehavior({ enabled: true });
    const title = behavior['getDashboardTitle']();

    expect(title).toBeUndefined();
  });
});
