/**
 * Integration tests for DashboardMemoryMonitor
 * These tests avoid complex mocking and test the actual integration behavior
 */

import { config } from '@grafana/runtime';

describe('DashboardMemoryMonitor Integration Tests', () => {
  beforeEach(() => {
    // Reset config between tests
    (
      config as unknown as { dashboardMemoryMonitoring: string[]; dashboardMemoryMonitoringInterval: string }
    ).dashboardMemoryMonitoring = ['*'];
    (
      config as unknown as { dashboardMemoryMonitoring: string[]; dashboardMemoryMonitoringInterval: string }
    ).dashboardMemoryMonitoringInterval = '30s';
  });

  it('should import and instantiate successfully', async () => {
    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');
    const monitor = new DashboardMemoryMonitor();
    expect(monitor).toBeDefined();
  });

  it('should handle missing performance.memory gracefully', async () => {
    // Temporarily remove performance.memory
    const originalMemory = (performance as unknown as { memory?: unknown }).memory;
    delete (performance as unknown as { memory?: unknown }).memory;

    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');
    const monitor = new DashboardMemoryMonitor();

    expect(() => {
      monitor.startMonitoring({ dashboardUid: 'test' });
    }).not.toThrow();

    monitor.stopMonitoring();

    // Restore performance.memory
    (performance as unknown as { memory?: unknown }).memory = originalMemory;
  });

  it('should handle configuration changes', async () => {
    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');

    // Test with 10s interval
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '10s';
    const monitor1 = new DashboardMemoryMonitor();
    expect(monitor1['intervalMs']).toBe(10000);

    // Test with 2m interval
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '2m';
    const monitor2 = new DashboardMemoryMonitor();
    expect(monitor2['intervalMs']).toBe(120000);

    // Test minimum enforcement with milliseconds
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '500';
    const monitor3 = new DashboardMemoryMonitor();
    expect(monitor3['intervalMs']).toBe(1000);
  });

  it('should have correct supported events', async () => {
    const { MemoryUsageBackend } = await import('../../../core/services/echo/backends/MemoryUsageBackend');
    const { EchoEventType } = await import('@grafana/runtime');

    const backend = new MemoryUsageBackend({});
    expect(backend.supportedEvents).toEqual([EchoEventType.MemoryUsage]);
  });

  it('should handle start and stop monitoring lifecycle', async () => {
    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');
    const monitor = new DashboardMemoryMonitor();

    // Should start without errors
    expect(() => {
      monitor.startMonitoring({ dashboardUid: 'test-dashboard' });
    }).not.toThrow();

    // Should stop without errors
    expect(() => {
      monitor.stopMonitoring();
    }).not.toThrow();

    monitor.destroy();
  });

  it('should verify timer setup and cleanup', async () => {
    // Set short interval for testing (use supported format)
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '1s';
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = ['*'];

    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');

    // Create monitor with 1s interval
    const monitor = new DashboardMemoryMonitor();
    expect(monitor['intervalMs']).toBe(1000);

    try {
      // Start monitoring
      monitor.startMonitoring({ dashboardUid: 'interval-test-dashboard' });

      // Verify the timer is active and configured correctly
      expect(monitor['monitoringTimer']).toBeDefined();
      expect(monitor['currentDashboardUid']).toBe('interval-test-dashboard');

      // Test that stopping clears the timer
      monitor.stopMonitoring();
      expect(monitor['monitoringTimer']).toBeUndefined();
      expect(monitor['currentDashboardUid']).toBeUndefined();
    } finally {
      monitor.destroy();
    }
  });

  it('should take immediate measurement and continue on intervals', async () => {
    // Set up configuration
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '1s';
    (config as unknown as { dashboardMemoryMonitoring: string[] }).dashboardMemoryMonitoring = ['*'];

    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');
    const monitor = new DashboardMemoryMonitor();

    // Spy on the takeMemoryMeasurement method to track when it's called
    let measurementCalls = 0;
    const originalTakeMemoryMeasurement = monitor['takeMemoryMeasurement'];
    monitor['takeMemoryMeasurement'] = function () {
      measurementCalls++;
      // Call original but handle potential errors gracefully
      try {
        return originalTakeMemoryMeasurement.call(this);
      } catch (e) {
        // Handle missing performance.memory gracefully in tests
        return Promise.resolve();
      }
    };

    jest.useFakeTimers();

    try {
      // Test immediate measurement on start
      monitor.startMonitoring({
        dashboardUid: 'test-immediate-and-interval',
        dashboardTitle: 'Test Dashboard',
      });

      // Verify immediate measurement was taken
      expect(measurementCalls).toBe(1);

      // Verify timer is set up
      expect(monitor['monitoringTimer']).toBeDefined();
      expect(monitor['currentDashboardUid']).toBe('test-immediate-and-interval');
      expect(monitor['currentDashboardTitle']).toBe('Test Dashboard');

      // Fast forward 1 second to trigger interval measurement
      jest.advanceTimersByTime(1000);

      // Verify interval measurement was taken
      expect(measurementCalls).toBe(2);

      // Fast forward another second
      jest.advanceTimersByTime(1000);

      // Verify another interval measurement
      expect(measurementCalls).toBe(3);

      // Stop monitoring
      monitor.stopMonitoring();
      const finalCallCount = measurementCalls;

      // Verify timer cleanup
      expect(monitor['monitoringTimer']).toBeUndefined();
      expect(monitor['currentDashboardUid']).toBeUndefined();
      expect(monitor['currentDashboardTitle']).toBeUndefined();

      // Fast forward more time - should not trigger new measurements
      jest.advanceTimersByTime(2000);

      // Verify no new measurements after stopping
      expect(measurementCalls).toBe(finalCallCount);
    } finally {
      // Restore original method
      monitor['takeMemoryMeasurement'] = originalTakeMemoryMeasurement;
      jest.useRealTimers();
      monitor.destroy();
    }
  });

  it('should respect different interval configurations', async () => {
    const { DashboardMemoryMonitor } = await import('./DashboardMemoryMonitor');

    // Test 2 second interval
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '2s';
    const monitor2s = new DashboardMemoryMonitor();
    expect(monitor2s['intervalMs']).toBe(2000);

    // Test 1 minute interval
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '1m';
    const monitor1m = new DashboardMemoryMonitor();
    expect(monitor1m['intervalMs']).toBe(60000);

    // Test minimum enforcement (less than 1s should default to 1s)
    (config as unknown as { dashboardMemoryMonitoringInterval: string }).dashboardMemoryMonitoringInterval = '500';
    const monitorMin = new DashboardMemoryMonitor();
    expect(monitorMin['intervalMs']).toBe(1000);
  });
});
