import { stringToMs } from '@grafana/data';
import { config, getEchoSrv, EchoEventType, logMeasurement } from '@grafana/runtime';
import { createLogger } from '@grafana/ui';
import { contextSrv } from 'app/core/services/context_srv';

export interface MemoryMeasurement {
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface DashboardMemoryMonitorOptions {
  dashboardUid: string;
  dashboardTitle?: string;
}

/**
 * Service for monitoring dashboard memory usage at configurable intervals
 * Follows singleton pattern and integrates with Grafana configuration
 */
export class DashboardMemoryMonitor {
  private monitoringTimer?: number;
  private currentDashboardUid?: string;
  private currentDashboardTitle?: string;
  private intervalMs = 30000; // Default 30s
  private isTabVisible = true;
  private logger = createLogger('DashboardMemoryMonitor', 'grafana.debug.memory');

  constructor() {
    this.parseConfiguredInterval();
    this.setupVisibilityHandling();
  }

  /**
   * Start monitoring memory for a specific dashboard
   */
  startMonitoring(options: DashboardMemoryMonitorOptions): void {
    const { dashboardUid, dashboardTitle } = options;

    this.logger.logger('startMonitoring', false, 'called with:', { dashboardUid });
    this.logger.logger('startMonitoring', false, 'config.dashboardMemoryMonitoring:', config.dashboardMemoryMonitoring);

    // Check if monitoring is enabled for this dashboard
    if (!this.shouldMonitorDashboard(dashboardUid)) {
      this.logger.logger('startMonitoring', false, 'Monitoring not enabled for dashboard:', dashboardUid);
      return;
    }

    // Stop existing monitoring if running
    this.stopMonitoring();

    this.logger.logger('startMonitoring', false, 'Starting monitoring for dashboard:', dashboardUid, dashboardTitle);
    this.currentDashboardUid = dashboardUid;
    this.currentDashboardTitle = dashboardTitle || undefined;

    // Take immediate measurement when monitoring starts
    this.takeMemoryMeasurement();

    // Then schedule regular intervals
    this.scheduleNextMeasurement();
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = undefined;
    }
    this.currentDashboardUid = undefined;
    this.currentDashboardTitle = undefined;
  }

  /**
   * Take a memory measurement and send it to Echo service
   */
  private takeMemoryMeasurement(): void {
    this.logger.logger('takeMemoryMeasurement', false, 'called. currentDashboardUid:', this.currentDashboardUid);

    if (!this.currentDashboardUid) {
      this.logger.logger('takeMemoryMeasurement', false, 'No currentDashboardUid, skipping measurement');
      return;
    }

    try {
      const memoryInfo = this.getMemoryInfo();
      this.logger.logger('takeMemoryMeasurement', false, 'getMemoryInfo result:', memoryInfo);

      if (!memoryInfo) {
        this.logger.logger('takeMemoryMeasurement', false, 'No memory info available, skipping measurement');
        return;
      }

      // Prepare measurement payload for both Echo and Faro
      const measurementPayload = {
        totalJSHeapSize: memoryInfo.totalJSHeapSize,
        usedJSHeapSize: memoryInfo.usedJSHeapSize,
        jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
        memoryUsagePercentage: (memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100,
      };

      this.logger.logger(
        'takeMemoryMeasurement',
        false,
        'Sending memory measurement to Echo and Faro:',
        measurementPayload
      );

      // Send to Echo service for debug logging (existing functionality)
      getEchoSrv().addEvent({
        type: EchoEventType.MemoryUsage,
        payload: {
          ...measurementPayload,
          dashboardUid: this.currentDashboardUid,
          dashboardTitle: this.currentDashboardTitle,
        },
      });

      // Send to Faro for metrics collection (new functionality)
      logMeasurement('dashboard_memory', measurementPayload, {
        dashboard: this.currentDashboardUid || '',
        title: this.currentDashboardTitle || '',
        monitoringInterval: this.intervalMs.toString(),
      });

      this.logger.logger('takeMemoryMeasurement', false, 'Memory measurements sent to both Echo and Faro successfully');
    } catch (error) {
      console.warn('Failed to capture memory measurement:', error);
    }
  }

  /**
   * Get memory information from performance.memory API with fallback
   */
  private getMemoryInfo(): { totalJSHeapSize: number; usedJSHeapSize: number; jsHeapSizeLimit: number } | null {
    // Check if performance.memory is available (primarily Chromium-based browsers)
    // Type guard to check if performance has memory property
    const hasMemoryProperty = (
      perf: Performance
    ): perf is Performance & {
      memory: {
        totalJSHeapSize: number;
        usedJSHeapSize: number;
        jsHeapSizeLimit: number;
      };
    } => {
      return 'memory' in perf && perf.memory !== null;
    };

    if (
      typeof performance !== 'undefined' &&
      hasMemoryProperty(performance) &&
      performance.memory &&
      typeof performance.memory.totalJSHeapSize === 'number'
    ) {
      return {
        totalJSHeapSize: performance.memory.totalJSHeapSize,
        usedJSHeapSize: performance.memory.usedJSHeapSize,
        jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
      };
    }

    // Graceful fallback for browsers without performance.memory
    return null;
  }

  /**
   * Schedule the next memory measurement
   */
  private scheduleNextMeasurement(): void {
    this.logger.logger('scheduleNextMeasurement', false, 'called. currentDashboardUid:', this.currentDashboardUid);

    if (!this.currentDashboardUid) {
      this.logger.logger('scheduleNextMeasurement', false, 'No currentDashboardUid, skipping timer setup');
      return;
    }

    this.logger.logger('scheduleNextMeasurement', false, 'Setting up timer for', this.intervalMs, 'ms');

    this.monitoringTimer = window.setTimeout(() => {
      this.logger.logger(
        'timer',
        false,
        'Timer fired. Tab visible:',
        this.isTabVisible,
        'Grafana visible:',
        contextSrv.isGrafanaVisible()
      );

      // Only take measurement if tab is visible
      if (this.isTabVisible && contextSrv.isGrafanaVisible()) {
        this.takeMemoryMeasurement();
      }

      // Schedule next measurement
      this.scheduleNextMeasurement();
    }, this.intervalMs);
  }

  /**
   * Check if monitoring should be enabled for the given dashboard UID
   */
  private shouldMonitorDashboard(dashboardUid: string): boolean {
    const configuredDashboards = config.dashboardMemoryMonitoring || [];

    // If empty array, monitoring is disabled
    if (configuredDashboards.length === 0) {
      return false;
    }

    // Check for wildcard (monitor all dashboards)
    if (configuredDashboards.includes('*')) {
      return true;
    }

    // Check for specific dashboard UID
    return configuredDashboards.includes(dashboardUid);
  }

  /**
   * Parse configured interval string to milliseconds using Grafana's stringToMs helper
   */
  private parseConfiguredInterval(): void {
    const intervalStr = config.dashboardMemoryMonitoringInterval || '30s';

    this.logger.logger('parseConfiguredInterval', false, 'Parsing interval configuration:', intervalStr);

    try {
      const parsedMs = stringToMs(intervalStr);
      this.logger.logger('parseConfiguredInterval', false, 'Parsed interval (ms):', parsedMs);
      this.intervalMs = parsedMs;
    } catch (error) {
      console.warn('Invalid memory monitoring interval configuration:', intervalStr, error);
      this.intervalMs = 30000; // Default 30s
    }

    // Enforce minimum interval of 1 second to prevent excessive measurements
    const originalMs = this.intervalMs;
    this.intervalMs = Math.max(this.intervalMs, 1000);

    if (originalMs !== this.intervalMs) {
      this.logger.logger(
        'parseConfiguredInterval',
        false,
        'Interval adjusted from',
        originalMs,
        'ms to minimum',
        this.intervalMs,
        'ms'
      );
    } else {
      this.logger.logger('parseConfiguredInterval', false, 'Final interval (ms):', this.intervalMs);
    }
  }

  /**
   * Set up browser tab visibility handling
   */
  private setupVisibilityHandling(): void {
    document.addEventListener('visibilitychange', () => {
      this.isTabVisible = !document.hidden;
    });
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stopMonitoring();
    // Note: Can't remove visibilitychange listener as we don't store the reference
    // This is acceptable as the service is a singleton that lives for the app lifetime
  }
}

// Singleton instance
let dashboardMemoryMonitor: DashboardMemoryMonitor | undefined;

/**
 * Get the singleton DashboardMemoryMonitor instance
 */
export function getDashboardMemoryMonitor(): DashboardMemoryMonitor {
  if (!dashboardMemoryMonitor) {
    dashboardMemoryMonitor = new DashboardMemoryMonitor();
  }
  return dashboardMemoryMonitor;
}

/**
 * Set the DashboardMemoryMonitor instance (for testing)
 */
export function setDashboardMemoryMonitor(instance: DashboardMemoryMonitor): void {
  dashboardMemoryMonitor = instance;
}
