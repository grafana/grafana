import { logMeasurement, reportInteraction } from '@grafana/runtime';
import { performanceUtils } from '@grafana/scenes';

import { SLOW_OPERATION_THRESHOLD_MS } from './performanceConstants';
import {
  registerPerformanceObserver,
  getPerformanceMemory,
  writePerformanceGroupStart,
  writePerformanceGroupLog,
  writePerformanceGroupEnd,
} from './performanceUtils';

/**
 * Panel metrics structure for analytics
 */
interface PanelAnalyticsMetrics {
  panelId: string;
  panelKey: string;
  pluginId: string;
  pluginVersion?: string;
  totalQueryTime: number;
  totalFieldConfigTime: number;
  totalTransformationTime: number;
  totalRenderTime: number;
  pluginLoadTime: number;
  queryOperations: Array<{
    duration: number;
    timestamp: number;
    queryType?: string;
    seriesCount?: number;
    dataPointsCount?: number;
  }>;
  fieldConfigOperations: Array<{
    duration: number;
    timestamp: number;
  }>;
  transformationOperations: Array<{
    duration: number;
    timestamp: number;
    transformationId?: string;
    success?: boolean;
    outputSeriesCount?: number;
  }>;
  renderOperations: Array<{
    duration: number;
    timestamp: number;
  }>;
}

/**
 * Aggregates Scene performance events into analytics-ready panel metrics
 */
export class DashboardAnalyticsAggregator implements performanceUtils.ScenePerformanceObserver {
  private panelMetrics = new Map<string, PanelAnalyticsMetrics>();
  private dashboardUID = '';
  private dashboardTitle = '';

  public initialize(uid: string, title: string) {
    // Clear previous dashboard data and set new context
    this.panelMetrics.clear();
    this.dashboardUID = uid;
    this.dashboardTitle = title;
  }

  public destroy() {
    // Clear dashboard context
    this.panelMetrics.clear();
    this.dashboardUID = '';
    this.dashboardTitle = '';
  }

  /**
   * Clear all collected metrics (called on dashboard interaction start)
   */
  public clearMetrics() {
    this.panelMetrics.clear();
  }

  /**
   * Get aggregated panel metrics for analytics
   */
  public getPanelMetrics(): PanelAnalyticsMetrics[] {
    return Array.from(this.panelMetrics.values());
  }

  // Dashboard-level events (we don't need to track these for panel analytics)
  onDashboardInteractionStart = (data: performanceUtils.DashboardInteractionStartData): void => {
    // Clear metrics when new dashboard interaction starts
    this.clearMetrics();
  };

  onDashboardInteractionMilestone = (_data: performanceUtils.DashboardInteractionMilestoneData): void => {
    // No action needed for milestones in analytics
  };

  onDashboardInteractionComplete = (data: performanceUtils.DashboardInteractionCompleteData): void => {
    // Send analytics report for dashboard interaction completion
    this.sendAnalyticsReport(data);
  };

  // Panel-level events
  onPanelOperationStart = (data: performanceUtils.PanelPerformanceData): void => {
    // Start events don't need aggregation, just ensure panel exists
    this.ensurePanelExists(data.panelKey, data.panelId, data.pluginId, data.pluginVersion);
  };

  onPanelOperationComplete = (data: performanceUtils.PanelPerformanceData): void => {
    // Aggregate panel metrics without verbose logging (handled by ScenePerformanceLogger)
    const panel = this.panelMetrics.get(data.panelKey);
    if (!panel) {
      console.warn('Panel not found for operation completion:', data.panelKey);
      return;
    }

    const duration = data.duration || 0;

    switch (data.operation) {
      case 'fieldConfig':
        panel.totalFieldConfigTime += duration;
        panel.fieldConfigOperations.push({
          duration,
          timestamp: data.timestamp,
        });
        break;

      case 'transform':
        panel.totalTransformationTime += duration;
        panel.transformationOperations.push({
          duration,
          timestamp: data.timestamp,
          transformationId: data.metadata.transformationId,
          success: data.metadata.success,
        });
        break;

      case 'query':
        panel.totalQueryTime += duration;
        panel.queryOperations.push({
          duration,
          timestamp: data.timestamp,
          queryType: data.metadata.queryType,
        });
        break;

      case 'render':
        panel.totalRenderTime += duration;
        panel.renderOperations.push({
          duration,
          timestamp: data.timestamp,
        });
        break;

      case 'plugin-load':
        panel.pluginLoadTime += duration;
        break;
    }
  };

  // Query-level events
  onQueryStart = (_data: performanceUtils.QueryPerformanceData): void => {
    // no-op
  };

  onQueryComplete = (_data: performanceUtils.QueryPerformanceData): void => {
    // no-op
  };

  /**
   * Ensure a panel exists in our tracking map
   */
  private ensurePanelExists(
    panelKey: string,
    panelId: string,
    pluginId: string,
    pluginVersion?: string
  ): PanelAnalyticsMetrics {
    let panel = this.panelMetrics.get(panelKey);
    if (!panel) {
      panel = {
        panelId,
        panelKey,
        pluginId,
        pluginVersion,
        totalQueryTime: 0,
        totalFieldConfigTime: 0,
        totalTransformationTime: 0,
        totalRenderTime: 0,
        pluginLoadTime: 0,
        queryOperations: [],
        fieldConfigOperations: [],
        transformationOperations: [],
        renderOperations: [],
      };
      this.panelMetrics.set(panelKey, panel);
    }
    return panel;
  }

  /**
   * Send analytics report for dashboard interactions
   */
  private sendAnalyticsReport(data: performanceUtils.DashboardInteractionCompleteData): void {
    const payload = {
      duration: data.duration || 0,
      networkDuration: data.networkDuration || 0,
      startTs: data.timestamp,
      endTs: data.timestamp + (data.duration || 0),
      timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
      longFramesCount: data.longFramesCount,
      longFramesTotalTime: data.longFramesTotalTime,
      ...getPerformanceMemory(),
    };

    const panelMetrics = this.getPanelMetrics();

    this.logDashboardAnalyticsEvent(data, payload, panelMetrics);

    reportInteraction('dashboard_render', {
      interactionType: data.interactionType,
      uid: this.dashboardUID,
      ...payload,
    });

    logMeasurement('dashboard_render', payload, {
      interactionType: data.interactionType,
      dashboard: this.dashboardUID,
      title: this.dashboardTitle,
    });
  }

  /**
   * Log dashboard analytics event with panel metrics and performance insights
   */
  private logDashboardAnalyticsEvent(
    data: performanceUtils.DashboardInteractionCompleteData,
    payload: Record<string, unknown>,
    panelMetrics: PanelAnalyticsMetrics[] | null
  ): void {
    const panelCount = panelMetrics?.length || 0;
    const panelSummary = panelCount ? `${panelCount} panels analyzed` : 'No panel metrics';

    // Main analytics summary
    const slowPanelCount =
      panelMetrics?.filter(
        (p) =>
          p.totalQueryTime + p.totalTransformationTime + p.totalRenderTime + p.totalFieldConfigTime + p.pluginLoadTime >
          SLOW_OPERATION_THRESHOLD_MS
      ).length || 0;

    writePerformanceGroupStart(
      'DAA',
      `[ANALYTICS] ${data.interactionType} | ${panelSummary}${slowPanelCount > 0 ? ` | ${slowPanelCount} slow panels ⚠️` : ''}`
    );

    // Dashboard overview
    writePerformanceGroupLog('DAA', '📊 Dashboard (ms):', {
      duration: Math.round((data.duration || 0) * 10) / 10,
      network: Math.round((data.networkDuration || 0) * 10) / 10,
      interactionType: data.interactionType,
      slowPanels: slowPanelCount,
    });

    // Analytics payload
    writePerformanceGroupLog('DAA', '📈 Analytics payload:', payload);

    // Individual collapsible panel logs with detailed breakdown
    if (panelMetrics && panelMetrics.length > 0) {
      panelMetrics.forEach((panel) => {
        const totalPanelTime =
          panel.totalQueryTime +
          panel.totalTransformationTime +
          panel.totalRenderTime +
          panel.totalFieldConfigTime +
          panel.pluginLoadTime;

        const isSlowPanel = totalPanelTime > SLOW_OPERATION_THRESHOLD_MS;
        const slowWarning = isSlowPanel ? ' ⚠️ SLOW' : '';

        writePerformanceGroupStart(
          'DAA',
          `🎨 Panel ${panel.pluginId}-${panel.panelId}: ${totalPanelTime.toFixed(1)}ms total${slowWarning}`
        );

        writePerformanceGroupLog('DAA', '🔧 Plugin:', {
          id: panel.pluginId,
          version: panel.pluginVersion || 'unknown',
          panelId: panel.panelId,
          panelKey: panel.panelKey,
        });

        writePerformanceGroupLog('DAA', '⚡ Performance (ms):', {
          totalTime: Math.round(totalPanelTime * 10) / 10, // Round to 1 decimal
          isSlowPanel: isSlowPanel,
          breakdown: {
            query: Math.round(panel.totalQueryTime * 10) / 10,
            transform: Math.round(panel.totalTransformationTime * 10) / 10,
            render: Math.round(panel.totalRenderTime * 10) / 10,
            fieldConfig: Math.round(panel.totalFieldConfigTime * 10) / 10,
            pluginLoad: Math.round(panel.pluginLoadTime * 10) / 10,
          },
        });

        if (panel.queryOperations.length > 0) {
          writePerformanceGroupLog('DAA', '📊 Queries:', {
            count: panel.queryOperations.length,
            details: panel.queryOperations.map((op, index) => ({
              operation: index + 1,
              duration: Math.round(op.duration * 10) / 10,
              timestamp: op.timestamp,
              queryType: op.queryType || 'unknown',
            })),
          });
        }

        if (panel.transformationOperations.length > 0) {
          writePerformanceGroupLog('DAA', '🔄 Transformations:', {
            count: panel.transformationOperations.length,
            details: panel.transformationOperations.map((op, index) => ({
              operation: index + 1,
              duration: Math.round(op.duration * 10) / 10,
              timestamp: op.timestamp,
              transformationId: op.transformationId || 'unknown',
              success: op.success !== false,
            })),
          });
        }

        if (panel.renderOperations.length > 0) {
          writePerformanceGroupLog('DAA', '🎨 Renders:', {
            count: panel.renderOperations.length,
            details: panel.renderOperations.map((op, index) => ({
              operation: index + 1,
              duration: Math.round(op.duration * 10) / 10,
              timestamp: op.timestamp,
            })),
          });
        }

        if (panel.fieldConfigOperations.length > 0) {
          writePerformanceGroupLog('DAA', '⚙️ FieldConfigs:', {
            count: panel.fieldConfigOperations.length,
            details: panel.fieldConfigOperations.map((op, index) => ({
              operation: index + 1,
              duration: Math.round(op.duration * 10) / 10,
              timestamp: op.timestamp,
            })),
          });
        }

        writePerformanceGroupEnd();
      });
    }

    writePerformanceGroupEnd();
  }
}

// Global singleton instance with lazy initialization
let dashboardAnalyticsAggregator: DashboardAnalyticsAggregator | null = null;

export function initializeDashboardAnalyticsAggregator(): DashboardAnalyticsAggregator {
  if (!dashboardAnalyticsAggregator) {
    dashboardAnalyticsAggregator = new DashboardAnalyticsAggregator();

    // Register as global performance observer
    registerPerformanceObserver(dashboardAnalyticsAggregator, 'DAA');
  }
  return dashboardAnalyticsAggregator;
}

export function getDashboardAnalyticsAggregator(): DashboardAnalyticsAggregator {
  return initializeDashboardAnalyticsAggregator();
}
