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

import {
  PanelPerformanceCollector,
  PanelLifecyclePhase,
  getPanelPerformanceCollector,
  resetPanelPerformanceCollector,
} from './PanelPerformanceCollector';

describe('PanelPerformanceCollector', () => {
  let collector: PanelPerformanceCollector;
  let performanceNowSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let memoryMock: { usedJSHeapSize: number; totalJSHeapSize: number; jsHeapSizeLimit: number };

  beforeEach(() => {
    collector = new PanelPerformanceCollector();

    // Mock performance.now() for consistent timing
    performanceNowSpy = jest.spyOn(performance, 'now');

    // Mock console.warn to avoid test failures
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    // Mock performance.memory
    memoryMock = {
      usedJSHeapSize: 1000000,
      totalJSHeapSize: 2000000,
      jsHeapSizeLimit: 4000000,
    };
    Object.defineProperty(performance, 'memory', {
      value: memoryMock,
      configurable: true,
    });
  });

  afterEach(() => {
    performanceNowSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    // Reset performance.memory
    Object.defineProperty(performance, 'memory', {
      value: undefined,
      configurable: true,
    });
  });

  describe('Panel Tracking', () => {
    it('should start tracking a new panel', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries', '1.0.0');

      expect(collector.isPanelTracked('panel-1')).toBe(true);
      expect(collector.getPanelCount()).toBe(1);
    });

    it('should increment render count for already tracked panel', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.startPanelTracking('panel-1', '1', 'timeseries');

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.renderCount).toBe(2);
    });

    it('should track multiple panels simultaneously', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.startPanelTracking('panel-2', '2', 'table');
      collector.startPanelTracking('panel-3', '3', 'gauge');

      expect(collector.getPanelCount()).toBe(3);
      expect(collector.isPanelTracked('panel-1')).toBe(true);
      expect(collector.isPanelTracked('panel-2')).toBe(true);
      expect(collector.isPanelTracked('panel-3')).toBe(true);
    });

    it('should capture initial memory when available', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');

      // Initial memory should be captured internally
      // Simulate some activity and memory increase
      performanceNowSpy.mockReturnValueOnce(1000);
      collector.startPhase('panel-1', PanelLifecyclePhase.Render);
      memoryMock.usedJSHeapSize = 1500000; // Increase memory
      performanceNowSpy.mockReturnValueOnce(1100);
      collector.endPhase('panel-1', PanelLifecyclePhase.Render);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.memoryIncrease).toBe(500000);
    });
  });

  describe('Phase Timing', () => {
    beforeEach(() => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
    });

    it('should track phase timing correctly', () => {
      performanceNowSpy.mockReturnValueOnce(1000); // Start time
      collector.startPhase('panel-1', PanelLifecyclePhase.PluginLoad);

      performanceNowSpy.mockReturnValueOnce(1050); // End time
      collector.endPhase('panel-1', PanelLifecyclePhase.PluginLoad);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.pluginLoadTime).toBe(50);
    });

    it('should track multiple phases', () => {
      // Plugin load: 1000-1050 (50ms)
      performanceNowSpy.mockReturnValueOnce(1000);
      collector.startPhase('panel-1', PanelLifecyclePhase.PluginLoad);
      performanceNowSpy.mockReturnValueOnce(1050);
      collector.endPhase('panel-1', PanelLifecyclePhase.PluginLoad);

      // Query: 1100-1300 (200ms)
      performanceNowSpy.mockReturnValueOnce(1100);
      collector.startPhase('panel-1', PanelLifecyclePhase.DataQuery);
      performanceNowSpy.mockReturnValueOnce(1300);
      collector.endPhase('panel-1', PanelLifecyclePhase.DataQuery);

      // Data processing: 1300-1350 (50ms)
      performanceNowSpy.mockReturnValueOnce(1300);
      collector.startPhase('panel-1', PanelLifecyclePhase.DataProcessing);
      performanceNowSpy.mockReturnValueOnce(1350);
      collector.endPhase('panel-1', PanelLifecyclePhase.DataProcessing);

      // Render: 1400-1500 (100ms)
      performanceNowSpy.mockReturnValueOnce(1400);
      collector.startPhase('panel-1', PanelLifecyclePhase.Render);
      performanceNowSpy.mockReturnValueOnce(1500);
      collector.endPhase('panel-1', PanelLifecyclePhase.Render);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.pluginLoadTime).toBe(50);
      expect(metrics?.queryTime).toBe(200);
      expect(metrics?.dataProcessingTime).toBe(50);
      expect(metrics?.renderTime).toBe(100);
      expect(metrics?.totalTime).toBe(400);
    });

    it('should handle missing panel gracefully', () => {
      // Should not throw
      collector.startPhase('non-existent', PanelLifecyclePhase.Render);
      collector.endPhase('non-existent', PanelLifecyclePhase.Render);

      expect(collector.getPanelMetrics('non-existent')).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PanelPerformanceCollector] Panel non-existent not found for phase render'
      );
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle ending phase that was not started', () => {
      // Should not throw
      collector.endPhase('panel-1', PanelLifecyclePhase.DataQuery);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.queryTime).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '[PanelPerformanceCollector] Phase dataQuery was not started for panel panel-1'
      );
    });
  });

  describe('Plugin Cache Status', () => {
    it('should track plugin cache status', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.setPluginCacheStatus('panel-1', true);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.pluginLoadedFromCache).toBe(true);
    });

    it('should default to false for cache status', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.pluginLoadedFromCache).toBe(false);
    });
  });

  describe('Long Frame Metrics', () => {
    it('should update long frame metrics', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.updateLongFrameMetrics('panel-1', 3, 180);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.longFramesCount).toBe(3);
      expect(metrics?.longFramesTotalTime).toBe(180);
    });

    it('should accumulate long frame metrics across updates', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.updateLongFrameMetrics('panel-1', 2, 100);
      collector.updateLongFrameMetrics('panel-1', 3, 150);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.longFramesCount).toBe(5);
      expect(metrics?.longFramesTotalTime).toBe(250);
    });
  });

  describe('Data Metrics', () => {
    it('should set data metrics', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.setDataMetrics('panel-1', 1000, 5);

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.dataPointsCount).toBe(1000);
      expect(metrics?.seriesCount).toBe(5);
    });
  });

  describe('Error Tracking', () => {
    it('should record errors', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.recordError('panel-1', 'Failed to load data');

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.error).toBe('Failed to load data');
    });
  });

  describe('Memory Tracking', () => {
    it('should calculate memory increase', () => {
      memoryMock.usedJSHeapSize = 1000000;
      collector.startPanelTracking('panel-1', '1', 'timeseries');

      // Simulate memory increase
      memoryMock.usedJSHeapSize = 1500000;

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.memoryIncrease).toBe(500000);
    });

    it('should handle missing performance.memory API', () => {
      // Remove performance.memory
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true,
      });

      collector.startPanelTracking('panel-1', '1', 'timeseries');

      const metrics = collector.getPanelMetrics('panel-1');
      expect(metrics?.memoryIncrease).toBeUndefined();
    });
  });

  describe('Metrics Aggregation', () => {
    it('should get all panel metrics', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.startPanelTracking('panel-2', '2', 'table');
      collector.startPanelTracking('panel-3', '3', 'gauge');

      const allMetrics = collector.getAllPanelMetrics();
      expect(allMetrics).toHaveLength(3);
      expect(allMetrics.map((m) => m.panelKey)).toEqual(['panel-1', 'panel-2', 'panel-3']);
    });

    it('should return empty array when no panels tracked', () => {
      const allMetrics = collector.getAllPanelMetrics();
      expect(allMetrics).toEqual([]);
    });
  });

  describe('Cleanup Operations', () => {
    it('should remove panel metrics', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.startPanelTracking('panel-2', '2', 'table');

      collector.removePanelMetrics('panel-1');

      expect(collector.isPanelTracked('panel-1')).toBe(false);
      expect(collector.isPanelTracked('panel-2')).toBe(true);
      expect(collector.getPanelCount()).toBe(1);
    });

    it('should clear all metrics', () => {
      collector.startPanelTracking('panel-1', '1', 'timeseries');
      collector.startPanelTracking('panel-2', '2', 'table');
      collector.startPanelTracking('panel-3', '3', 'gauge');

      collector.clearMetrics();

      expect(collector.getPanelCount()).toBe(0);
      expect(collector.getAllPanelMetrics()).toEqual([]);
    });
  });

  describe('Complete Lifecycle Test', () => {
    it('should track complete panel lifecycle', () => {
      // Start tracking
      collector.startPanelTracking('panel-1', '1', 'timeseries', '1.0.0');
      collector.setPluginCacheStatus('panel-1', false);

      // Plugin load phase
      performanceNowSpy.mockReturnValueOnce(1000);
      collector.startPhase('panel-1', PanelLifecyclePhase.PluginLoad);
      performanceNowSpy.mockReturnValueOnce(1050);
      collector.endPhase('panel-1', PanelLifecyclePhase.PluginLoad);

      // Query phase
      performanceNowSpy.mockReturnValueOnce(1100);
      collector.startPhase('panel-1', PanelLifecyclePhase.DataQuery);
      performanceNowSpy.mockReturnValueOnce(1300);
      collector.endPhase('panel-1', PanelLifecyclePhase.DataQuery);

      // Data processing phase
      performanceNowSpy.mockReturnValueOnce(1300);
      collector.startPhase('panel-1', PanelLifecyclePhase.DataProcessing);
      performanceNowSpy.mockReturnValueOnce(1350);
      collector.endPhase('panel-1', PanelLifecyclePhase.DataProcessing);
      collector.setDataMetrics('panel-1', 5000, 10);

      // Render phase with long frames
      performanceNowSpy.mockReturnValueOnce(1400);
      collector.startPhase('panel-1', PanelLifecyclePhase.Render);
      collector.updateLongFrameMetrics('panel-1', 2, 120);
      performanceNowSpy.mockReturnValueOnce(1500);
      collector.endPhase('panel-1', PanelLifecyclePhase.Render);

      // Increase memory
      memoryMock.usedJSHeapSize = 2000000;

      const metrics = collector.getPanelMetrics('panel-1');

      expect(metrics).toEqual({
        panelId: '1',
        panelKey: 'panel-1',
        pluginId: 'timeseries',
        pluginVersion: '1.0.0',
        pluginLoadTime: 50,
        pluginLoadedFromCache: false,
        queryTime: 200,
        dataProcessingTime: 50,
        renderTime: 100,
        totalTime: 400,
        longFramesCount: 2,
        longFramesTotalTime: 120,
        renderCount: 1,
        dataPointsCount: 5000,
        seriesCount: 10,
        error: undefined,
        memoryIncrease: 1000000,
      });
    });
  });
});

describe('PanelPerformanceCollector Singleton', () => {
  afterEach(() => {
    resetPanelPerformanceCollector();
  });

  it('should return same instance', () => {
    const instance1 = getPanelPerformanceCollector();
    const instance2 = getPanelPerformanceCollector();

    expect(instance1).toBe(instance2);
  });

  it('should reset singleton instance', () => {
    const instance1 = getPanelPerformanceCollector();
    instance1.startPanelTracking('panel-1', '1', 'timeseries');

    resetPanelPerformanceCollector();

    const instance2 = getPanelPerformanceCollector();
    expect(instance1).not.toBe(instance2);
    expect(instance2.getPanelCount()).toBe(0);
  });
});
