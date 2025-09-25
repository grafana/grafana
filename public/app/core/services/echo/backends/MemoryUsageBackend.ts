import { store } from '@grafana/data';
import { EchoBackend, EchoEvent, EchoEventType, MemoryUsageEchoEvent, isMemoryUsageEvent } from '@grafana/runtime';
import { createLogger, attachDebugger } from '@grafana/ui';

export interface MemoryUsageBackendOptions {}

export interface MemoryMeasurement {
  timestamp: number;
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
  memoryUsagePercentage: number;
  dashboardUid?: string;
  dashboardTitle?: string;
}

/**
 * Echo backend for memory usage events
 * Logs memory events to console only when debug mode is enabled
 */
export class MemoryUsageBackend implements EchoBackend<MemoryUsageEchoEvent, MemoryUsageBackendOptions> {
  private buffer: MemoryUsageEchoEvent[] = [];
  private logger = createLogger('MemoryUsageBackend', 'grafana.debug.memory');
  private measurementHistory: MemoryMeasurement[] = [];
  private readonly HISTORY_SIZE = 30;
  supportedEvents = [EchoEventType.MemoryUsage];

  constructor(public options: MemoryUsageBackendOptions = {}) {
    // Attach debug interface for development
    const dashboardMemoryDebugger = {
      drawGraph: () => this.drawMemoryGraph(),
      getHistory: () => this.getHistory(),
    };

    attachDebugger('dashboardMemory', dashboardMemoryDebugger);
  }

  addEvent = (e: EchoEvent) => {
    if (isMemoryUsageEvent(e)) {
      this.logger.logger('addEvent', false, 'called, adding to buffer. Buffer size:', this.buffer.length + 1);
      this.buffer.push(e);

      // Immediately add to measurement history for on-demand graph rendering
      const usedJSHeapSize = e.payload.usedJSHeapSize;
      const jsHeapSizeLimit = e.payload.jsHeapSizeLimit;
      const memoryUsagePercentage =
        e.payload.memoryUsagePercentage || (jsHeapSizeLimit > 0 ? (usedJSHeapSize / jsHeapSizeLimit) * 100 : 0);

      const measurement: MemoryMeasurement = {
        timestamp: Date.now(),
        totalJSHeapSize: e.payload.totalJSHeapSize,
        usedJSHeapSize: usedJSHeapSize,
        jsHeapSizeLimit: jsHeapSizeLimit,
        memoryUsagePercentage: memoryUsagePercentage,
        dashboardUid: e.payload.dashboardUid,
        dashboardTitle: e.payload.dashboardTitle,
      };

      // Add to circular buffer (maintain last 30 measurements)
      this.measurementHistory.push(measurement);
      if (this.measurementHistory.length > this.HISTORY_SIZE) {
        this.measurementHistory.shift();
      }
    }
  };

  flush = () => {
    this.logger.logger('flush', false, 'called. Buffer size:', this.buffer.length);

    if (this.buffer.length === 0) {
      return;
    }

    // Log to console only when debug mode is enabled
    const debugEnabled = store.getObject('grafana.debug.memory') === true;
    this.logger.logger('flush', false, 'Debug enabled:', debugEnabled);

    if (debugEnabled) {
      this.buffer.forEach((event) => {
        this.logger.logger('flush', false, 'Memory measurement:', event.payload);
      });
    }

    // Always clear buffer after processing
    this.buffer = [];
  };

  /**
   * Get measurement history for debugging
   * @returns Array of memory measurements
   */
  private getHistory = (): MemoryMeasurement[] => {
    return [...this.measurementHistory];
  };

  /**
   * Draw ASCII memory graph to console
   */
  private drawMemoryGraph = (): void => {
    if (this.measurementHistory.length === 0) {
      console.log('📊 Memory Graph: No measurements available yet');
      console.log('💡 Tip: Navigate to a dashboard with memory monitoring enabled and wait for measurements');
      return;
    }

    const measurements = this.measurementHistory;
    const latest = measurements[measurements.length - 1];

    // Extract memory usage data (convert bytes to MB)
    const usedMemoryMB = measurements.map((m) => Math.round(m.usedJSHeapSize / (1024 * 1024)));
    const totalMemoryMB = Math.round(latest.jsHeapSizeLimit / (1024 * 1024));

    // Calculate graph dimensions
    const maxMemory = Math.max(...usedMemoryMB);
    const minMemory = Math.min(...usedMemoryMB);
    const range = Math.max(maxMemory - minMemory, 10); // Minimum range of 10MB
    const graphHeight = 10;
    const graphWidth = Math.min(measurements.length, 40); // Show up to 40 data points

    // Get recent measurements for graph
    const recentMeasurements = measurements.slice(-graphWidth);
    const recentUsedMB = recentMeasurements.map((m) => Math.round(m.usedJSHeapSize / (1024 * 1024)));

    // Calculate scale
    const scale = graphHeight / range;
    const baseValue = minMemory - 5; // Add some padding

    // Build the entire graph as a single string
    let graphOutput = '\n';
    graphOutput += `📊 Memory Usage (MB) [Dashboard: ${latest.dashboardTitle || latest.dashboardUid || 'Unknown'}] [Last ${measurements.length} measurements]\n`;

    // Draw graph
    for (let row = graphHeight; row >= 0; row--) {
      const yValue = Math.round(baseValue + row / scale);
      let line = `${yValue.toString().padStart(4)} |`;

      for (let col = 0; col < recentUsedMB.length; col++) {
        const memValue = recentUsedMB[col];
        const scaledValue = Math.round((memValue - baseValue) * scale);

        if (scaledValue === row) {
          line += '.';
        } else {
          line += ' ';
        }
      }

      graphOutput += line + '\n';
    }

    // X-axis
    const xAxis = '     └' + '─'.repeat(Math.max(recentUsedMB.length - 1, 0));
    graphOutput += xAxis + '\n';

    // Calculate growth rate
    let growthIndicator = '→';
    let growthRate = 0;
    if (measurements.length >= 2) {
      const firstMeasurement = measurements[0];
      const timeDiff = (latest.timestamp - firstMeasurement.timestamp) / 1000 / 60; // minutes
      const memoryDiff = (latest.usedJSHeapSize - firstMeasurement.usedJSHeapSize) / (1024 * 1024); // MB

      if (timeDiff > 0) {
        growthRate = memoryDiff / timeDiff;
        if (growthRate > 0.1) {
          growthIndicator = '↗';
        } else if (growthRate < -0.1) {
          growthIndicator = '↘';
        }
      }
    }

    // Summary
    const currentUsedMB = Math.round(latest.usedJSHeapSize / (1024 * 1024));
    const percentage = Math.round(latest.memoryUsagePercentage);
    graphOutput += `Usage: ${currentUsedMB}MB/${totalMemoryMB}MB (${percentage}%) ${growthIndicator} ${growthRate >= 0 ? '+' : ''}${growthRate.toFixed(1)}MB/min\n`;
    graphOutput += `📈 Call: _debug.dashboardMemory.getHistory() for raw data\n`;

    // Output the entire graph as a single console.log
    console.log(graphOutput);
  };
}
