import { PanelPerformanceData } from '@grafana/runtime';
import { isChromePerformance } from 'app/core/crash/crash.utils';

/**
 * Phase names for panel lifecycle tracking
 */
export enum PanelLifecyclePhase {
  PluginLoad = 'pluginLoad',
  DataQuery = 'dataQuery',
  DataProcessing = 'dataProcessing',
  Render = 'render',
}

interface PanelTrackingData {
  panelId: string;
  panelKey: string;
  pluginId: string;
  pluginVersion?: string;

  // Phase timing data
  phaseStartTimes: Map<string, number>;
  phaseDurations: Map<string, number>;

  // Performance metrics
  renderCount: number;
  longFramesCount: number;
  longFramesTotalTime: number;

  // Memory tracking
  initialMemory?: number;
  finalMemory?: number;

  // Data metrics
  dataPointsCount?: number;
  seriesCount?: number;

  // Error tracking
  error?: string;

  // Cache status
  pluginLoadedFromCache: boolean;
}

/**
 * Collects performance metrics for individual panels during dashboard interactions.
 * Tracks timing for different lifecycle phases and aggregates metrics.
 */
export class PanelPerformanceCollector {
  private panels: Map<string, PanelTrackingData> = new Map();

  /**
   * Start tracking a new panel
   */
  startPanelTracking(panelKey: string, panelId: string, pluginId: string, pluginVersion?: string): void {
    if (this.panels.has(panelKey)) {
      // Panel already being tracked, increment render count
      const panel = this.panels.get(panelKey)!;
      panel.renderCount++;
      return;
    }

    this.panels.set(panelKey, {
      panelId,
      panelKey,
      pluginId,
      pluginVersion,
      phaseStartTimes: new Map(),
      phaseDurations: new Map(),
      renderCount: 1,
      longFramesCount: 0,
      longFramesTotalTime: 0,
      pluginLoadedFromCache: false,
    });

    // Capture initial memory if available
    if (isChromePerformance(performance)) {
      const panel = this.panels.get(panelKey)!;
      panel.initialMemory = performance.memory.usedJSHeapSize;
    }
  }

  /**
   * Start timing a specific phase for a panel
   */
  startPhase(panelKey: string, phase: string): void {
    const panel = this.panels.get(panelKey);
    if (!panel) {
      console.warn(`[PanelPerformanceCollector] Panel ${panelKey} not found for phase ${phase}`);
      return;
    }

    panel.phaseStartTimes.set(phase, performance.now());
  }

  /**
   * End timing a specific phase for a panel
   */
  endPhase(panelKey: string, phase: string): void {
    const panel = this.panels.get(panelKey);
    if (!panel) {
      console.warn(`[PanelPerformanceCollector] Panel ${panelKey} not found for phase ${phase}`);
      return;
    }

    const startTime = panel.phaseStartTimes.get(phase);
    if (startTime === undefined) {
      console.warn(`[PanelPerformanceCollector] Phase ${phase} was not started for panel ${panelKey}`);
      return;
    }

    const duration = performance.now() - startTime;
    panel.phaseDurations.set(phase, duration);
    panel.phaseStartTimes.delete(phase);
  }

  /**
   * Set cache status for plugin loading
   */
  setPluginCacheStatus(panelKey: string, fromCache: boolean): void {
    const panel = this.panels.get(panelKey);
    if (panel) {
      panel.pluginLoadedFromCache = fromCache;
    }
  }

  /**
   * Update long frame metrics for a panel
   */
  updateLongFrameMetrics(panelKey: string, longFramesCount: number, longFramesTotalTime: number): void {
    const panel = this.panels.get(panelKey);
    if (panel) {
      panel.longFramesCount += longFramesCount;
      panel.longFramesTotalTime += longFramesTotalTime;
    }
  }

  /**
   * Set data metrics for a panel
   */
  setDataMetrics(panelKey: string, dataPointsCount: number, seriesCount: number): void {
    const panel = this.panels.get(panelKey);
    if (panel) {
      panel.dataPointsCount = dataPointsCount;
      panel.seriesCount = seriesCount;
    }
  }

  /**
   * Record an error for a panel
   */
  recordError(panelKey: string, error: string): void {
    const panel = this.panels.get(panelKey);
    if (panel) {
      panel.error = error;
    }
  }

  /**
   * Get performance metrics for a specific panel
   */
  getPanelMetrics(panelKey: string): PanelPerformanceData | undefined {
    const panel = this.panels.get(panelKey);
    if (!panel) {
      return undefined;
    }

    // Capture final memory if available
    if (isChromePerformance(performance) && panel.initialMemory !== undefined) {
      panel.finalMemory = performance.memory.usedJSHeapSize;
    }

    const pluginLoadTime = panel.phaseDurations.get(PanelLifecyclePhase.PluginLoad) || 0;
    const queryTime = panel.phaseDurations.get(PanelLifecyclePhase.DataQuery) || 0;
    const dataProcessingTime = panel.phaseDurations.get(PanelLifecyclePhase.DataProcessing) || 0;
    const renderTime = panel.phaseDurations.get(PanelLifecyclePhase.Render) || 0;

    return {
      panelId: panel.panelId,
      panelKey: panel.panelKey,
      pluginId: panel.pluginId,
      pluginVersion: panel.pluginVersion,
      pluginLoadTime,
      pluginLoadedFromCache: panel.pluginLoadedFromCache,
      queryTime,
      dataProcessingTime,
      renderTime,
      totalTime: pluginLoadTime + queryTime + dataProcessingTime + renderTime,
      longFramesCount: panel.longFramesCount,
      longFramesTotalTime: panel.longFramesTotalTime,
      renderCount: panel.renderCount,
      dataPointsCount: panel.dataPointsCount,
      seriesCount: panel.seriesCount,
      error: panel.error,
      memoryIncrease:
        panel.initialMemory !== undefined && panel.finalMemory !== undefined
          ? panel.finalMemory - panel.initialMemory
          : undefined,
    };
  }

  /**
   * Get performance metrics for all tracked panels
   */
  getAllPanelMetrics(): PanelPerformanceData[] {
    const metrics: PanelPerformanceData[] = [];

    for (const panelKey of this.panels.keys()) {
      const metric = this.getPanelMetrics(panelKey);
      if (metric) {
        metrics.push(metric);
      }
    }

    return metrics;
  }

  /**
   * Remove metrics for a specific panel
   */
  removePanelMetrics(panelKey: string): void {
    this.panels.delete(panelKey);
  }

  /**
   * Clear all collected metrics
   */
  clearMetrics(): void {
    this.panels.clear();
  }

  /**
   * Get the number of panels being tracked
   */
  getPanelCount(): number {
    return this.panels.size;
  }

  /**
   * Check if a panel is being tracked
   */
  isPanelTracked(panelKey: string): boolean {
    return this.panels.has(panelKey);
  }
}

// Singleton instance for global access
let collectorInstance: PanelPerformanceCollector | undefined;

/**
 * Get the singleton PanelPerformanceCollector instance
 */
export function getPanelPerformanceCollector(): PanelPerformanceCollector {
  if (!collectorInstance) {
    collectorInstance = new PanelPerformanceCollector();
  }
  return collectorInstance;
}

/**
 * Reset the singleton instance (mainly for testing)
 */
export function resetPanelPerformanceCollector(): void {
  collectorInstance = undefined;
}
