// Mock module to avoid importing real crash utils in tests
jest.mock('app/core/crash/crash.utils', () => ({
  isChromePerformance: (perf: unknown): perf is { memory: { usedJSHeapSize: number } } => {
    return (
      perf !== null &&
      typeof perf === 'object' &&
      'memory' in perf &&
      (perf as Record<string, unknown>).memory !== undefined
    );
  },
}));

import { PanelPerformanceCollector, PanelLifecyclePhase } from './PanelPerformanceCollector';

describe('PanelPerformanceCollector Integration Tests', () => {
  let collector: PanelPerformanceCollector;

  beforeEach(() => {
    collector = new PanelPerformanceCollector();
  });

  describe('Concurrent Panel Tracking', () => {
    it('should handle concurrent panel lifecycle tracking', async () => {
      const panelCount = 20;
      const panels: string[] = [];

      // Start tracking multiple panels
      for (let i = 0; i < panelCount; i++) {
        const panelKey = `panel-${i}`;
        panels.push(panelKey);
        collector.startPanelTracking(panelKey, String(i), i % 2 === 0 ? 'timeseries' : 'table');
      }

      // Simulate concurrent lifecycle phases
      const promises = panels.map(async (panelKey, index) => {
        // Simulate plugin load
        collector.startPhase(panelKey, PanelLifecyclePhase.PluginLoad);
        await simulateAsyncWork(10 + Math.random() * 20);
        collector.endPhase(panelKey, PanelLifecyclePhase.PluginLoad);
        collector.setPluginCacheStatus(panelKey, index % 3 === 0);

        // Simulate data query
        collector.startPhase(panelKey, PanelLifecyclePhase.DataQuery);
        await simulateAsyncWork(50 + Math.random() * 100);
        collector.endPhase(panelKey, PanelLifecyclePhase.DataQuery);

        // Simulate data processing
        collector.startPhase(panelKey, PanelLifecyclePhase.DataProcessing);
        await simulateAsyncWork(20 + Math.random() * 30);
        collector.endPhase(panelKey, PanelLifecyclePhase.DataProcessing);
        collector.setDataMetrics(panelKey, 1000 * (index + 1), 5 + index);

        // Simulate render with long frames
        collector.startPhase(panelKey, PanelLifecyclePhase.Render);
        if (index % 2 === 0) {
          collector.updateLongFrameMetrics(panelKey, 1 + Math.floor(Math.random() * 3), 50 + Math.random() * 100);
        }
        await simulateAsyncWork(30 + Math.random() * 50);
        collector.endPhase(panelKey, PanelLifecyclePhase.Render);

        // Simulate errors for some panels
        if (index % 5 === 0) {
          collector.recordError(panelKey, `Error loading panel ${index}`);
        }
      });

      // Wait for all panels to complete
      await Promise.all(promises);

      // Verify all panels were tracked correctly
      expect(collector.getPanelCount()).toBe(panelCount);

      const allMetrics = collector.getAllPanelMetrics();
      expect(allMetrics).toHaveLength(panelCount);

      // Verify each panel has complete metrics
      allMetrics.forEach((metrics, index) => {
        expect(metrics.panelId).toBe(String(index));
        expect(metrics.pluginLoadTime).toBeGreaterThan(0);
        expect(metrics.queryTime).toBeGreaterThan(0);
        expect(metrics.dataProcessingTime).toBeGreaterThan(0);
        expect(metrics.renderTime).toBeGreaterThan(0);
        expect(metrics.totalTime).toBeGreaterThan(0);
        expect(metrics.dataPointsCount).toBe(1000 * (index + 1));
        expect(metrics.seriesCount).toBe(5 + index);

        if (index % 3 === 0) {
          expect(metrics.pluginLoadedFromCache).toBe(true);
        }

        if (index % 2 === 0) {
          expect(metrics.longFramesCount).toBeGreaterThan(0);
          expect(metrics.longFramesTotalTime).toBeGreaterThan(0);
        }

        if (index % 5 === 0) {
          expect(metrics.error).toBe(`Error loading panel ${index}`);
        }
      });
    });

    it('should handle rapid panel re-renders', async () => {
      const panelKey = 'panel-1';
      const renderCount = 10;

      // Initial tracking
      collector.startPanelTracking(panelKey, '1', 'timeseries');

      // Simulate rapid re-renders
      for (let i = 0; i < renderCount - 1; i++) {
        collector.startPhase(panelKey, PanelLifecyclePhase.Render);
        await simulateAsyncWork(5);
        collector.endPhase(panelKey, PanelLifecyclePhase.Render);

        // Re-track to increment render count
        collector.startPanelTracking(panelKey, '1', 'timeseries');
      }

      const metrics = collector.getPanelMetrics(panelKey);
      expect(metrics?.renderCount).toBe(renderCount);
    });

    it('should handle interleaved phase operations', async () => {
      const panel1 = 'panel-1';
      const panel2 = 'panel-2';

      collector.startPanelTracking(panel1, '1', 'timeseries');
      collector.startPanelTracking(panel2, '2', 'table');

      // Start phases in interleaved order
      collector.startPhase(panel1, PanelLifecyclePhase.PluginLoad);
      collector.startPhase(panel2, PanelLifecyclePhase.PluginLoad);

      await simulateAsyncWork(10);

      collector.startPhase(panel1, PanelLifecyclePhase.DataQuery);
      collector.endPhase(panel2, PanelLifecyclePhase.PluginLoad);

      await simulateAsyncWork(10);

      collector.endPhase(panel1, PanelLifecyclePhase.PluginLoad);
      collector.startPhase(panel2, PanelLifecyclePhase.DataQuery);

      await simulateAsyncWork(10);

      collector.endPhase(panel1, PanelLifecyclePhase.DataQuery);
      collector.endPhase(panel2, PanelLifecyclePhase.DataQuery);

      // Verify both panels have correct metrics
      const metrics1 = collector.getPanelMetrics(panel1);
      const metrics2 = collector.getPanelMetrics(panel2);

      expect(metrics1?.pluginLoadTime).toBeGreaterThan(0);
      expect(metrics1?.queryTime).toBeGreaterThan(0);
      expect(metrics2?.pluginLoadTime).toBeGreaterThan(0);
      expect(metrics2?.queryTime).toBeGreaterThan(0);
    });
  });

  describe('Performance Overhead', () => {
    it('should have minimal overhead for tracking operations', () => {
      const iterations = 1000;
      const startTime = performance.now();

      // Perform many tracking operations
      for (let i = 0; i < iterations; i++) {
        const panelKey = `panel-${i}`;
        collector.startPanelTracking(panelKey, String(i), 'timeseries');
        collector.startPhase(panelKey, PanelLifecyclePhase.PluginLoad);
        collector.endPhase(panelKey, PanelLifecyclePhase.PluginLoad);
        collector.setPluginCacheStatus(panelKey, true);
        collector.updateLongFrameMetrics(panelKey, 1, 50);
        collector.setDataMetrics(panelKey, 1000, 5);
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / iterations;

      // Each operation should take less than 0.1ms on average
      expect(avgTimePerOperation).toBeLessThan(0.1);

      // Verify all operations completed correctly
      expect(collector.getPanelCount()).toBe(iterations);
    });

    it('should handle large metric aggregation efficiently', () => {
      const panelCount = 100;

      // Track many panels
      for (let i = 0; i < panelCount; i++) {
        const panelKey = `panel-${i}`;
        collector.startPanelTracking(panelKey, String(i), 'timeseries');

        // Add complete metrics for each panel
        collector.startPhase(panelKey, PanelLifecyclePhase.PluginLoad);
        collector.endPhase(panelKey, PanelLifecyclePhase.PluginLoad);
        collector.startPhase(panelKey, PanelLifecyclePhase.DataQuery);
        collector.endPhase(panelKey, PanelLifecyclePhase.DataQuery);
        collector.startPhase(panelKey, PanelLifecyclePhase.DataProcessing);
        collector.endPhase(panelKey, PanelLifecyclePhase.DataProcessing);
        collector.startPhase(panelKey, PanelLifecyclePhase.Render);
        collector.endPhase(panelKey, PanelLifecyclePhase.Render);
        collector.updateLongFrameMetrics(panelKey, 2, 100);
        collector.setDataMetrics(panelKey, 10000, 20);
      }

      // Measure aggregation time
      const startTime = performance.now();
      const allMetrics = collector.getAllPanelMetrics();
      const endTime = performance.now();

      expect(allMetrics).toHaveLength(panelCount);
      expect(endTime - startTime).toBeLessThan(10); // Should aggregate in < 10ms
    });
  });

  describe('Memory Management', () => {
    it('should properly clean up memory when removing panels', () => {
      const panelCount = 50;

      // Track many panels
      for (let i = 0; i < panelCount; i++) {
        collector.startPanelTracking(`panel-${i}`, String(i), 'timeseries');
      }

      expect(collector.getPanelCount()).toBe(panelCount);

      // Remove half the panels
      for (let i = 0; i < panelCount / 2; i++) {
        collector.removePanelMetrics(`panel-${i}`);
      }

      expect(collector.getPanelCount()).toBe(panelCount / 2);

      // Clear all remaining
      collector.clearMetrics();
      expect(collector.getPanelCount()).toBe(0);
      expect(collector.getAllPanelMetrics()).toEqual([]);
    });
  });
});

// Helper function to simulate async work
function simulateAsyncWork(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
