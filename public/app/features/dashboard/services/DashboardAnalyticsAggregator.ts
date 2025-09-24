import { logMeasurement, reportInteraction } from '@grafana/runtime';
import {
  type ScenePerformanceObserver,
  type PerformanceEventData,
  type PanelPerformanceData,
  type QueryPerformanceData,
  writePerformanceLog,
} from '@grafana/scenes';

/**
 * Panel metrics structure for analytics (matching existing SceneInteractionProfileEvent format)
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
    dataPointsCount?: number;
    seriesCount?: number;
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
 * Replaces the complex PanelPerformanceCollector with a clean observer-based approach
 */
export class DashboardAnalyticsAggregator implements ScenePerformanceObserver {
  private panelMetrics = new Map<string, PanelAnalyticsMetrics>();
  private isInitialized = false;
  private dashboardUID = '';
  private dashboardTitle = '';

  constructor() {
    // Bind all observer methods to preserve 'this' context when called by ScenePerformanceTracker
    this.onDashboardInteractionStart = this.onDashboardInteractionStart.bind(this);
    this.onDashboardInteractionMilestone = this.onDashboardInteractionMilestone.bind(this);
    this.onDashboardInteractionComplete = this.onDashboardInteractionComplete.bind(this);
    this.onPanelLifecycleStart = this.onPanelLifecycleStart.bind(this);
    this.onPanelOperationStart = this.onPanelOperationStart.bind(this);
    this.onPanelOperationComplete = this.onPanelOperationComplete.bind(this);
    this.onPanelLifecycleComplete = this.onPanelLifecycleComplete.bind(this);
    this.onQueryStart = this.onQueryStart.bind(this);
    this.onQueryComplete = this.onQueryComplete.bind(this);
  }

  public initialize(uid: string, title: string) {
    // Clear previous dashboard data
    this.panelMetrics.clear();
    this.dashboardUID = uid;
    this.dashboardTitle = title;
    this.isInitialized = true;
  }

  public destroy() {
    if (!this.isInitialized) {
      return;
    }

    this.panelMetrics.clear();
    this.isInitialized = false;
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
  onDashboardInteractionStart(data: PerformanceEventData): void {
    // Clear metrics when new dashboard interaction starts
    this.clearMetrics();
  }

  onDashboardInteractionMilestone(data: PerformanceEventData): void {
    // No action needed for milestones in analytics
  }

  onDashboardInteractionComplete(data: PerformanceEventData): void {
    // Replicate the logic from getDashboardInteractionCallback
    this.sendAnalyticsReport(data);
  }

  // Panel-level events
  onPanelLifecycleStart(data: PanelPerformanceData): void {
    this.ensurePanelExists(data.panelKey, data.panelId, data.pluginId, data.pluginVersion);
  }

  onPanelOperationStart(data: PanelPerformanceData): void {
    // Start events don't need aggregation, just ensure panel exists
    this.ensurePanelExists(data.panelKey, data.panelId, data.pluginId, data.pluginVersion);
  }

  onPanelOperationComplete(data: PanelPerformanceData): void {
    writePerformanceLog('DashboardAnalyticsAggregator', '🔍 onPanelOperationComplete called with:', data);

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
          dataPointsCount:
            typeof data.metadata?.dataPointsCount === 'number' ? data.metadata.dataPointsCount : undefined,
          seriesCount: typeof data.metadata?.seriesCount === 'number' ? data.metadata.seriesCount : undefined,
        });
        break;

      case 'transform':
        panel.totalTransformationTime += duration;
        panel.transformationOperations.push({
          duration,
          timestamp: data.timestamp,
          transformationId:
            typeof data.metadata?.transformationId === 'string' ? data.metadata.transformationId : undefined,
          success: typeof data.metadata?.success === 'boolean' ? data.metadata.success : undefined,
          outputSeriesCount:
            typeof data.metadata?.outputSeriesCount === 'number' ? data.metadata.outputSeriesCount : undefined,
        });
        break;

      case 'render':
        panel.totalRenderTime += duration;
        panel.renderOperations.push({
          duration,
          timestamp: data.timestamp,
        });
        break;
    }
  }

  onPanelLifecycleComplete(data: PanelPerformanceData): void {
    writePerformanceLog('DashboardAnalyticsAggregator', '🔍 onPanelLifecycleComplete called with:', data);

    // Ensure panel exists even if it never went through queries (cached renders)
    this.ensurePanelExists(data.panelKey, data.panelId, data.pluginId, data.pluginVersion);

    const panel = this.panelMetrics.get(data.panelKey);
    // writePerformanceLog(
    //   'DashboardAnalyticsAggregator',
    //   '🔍 Panel found in metrics:',
    //   panel ? 'YES' : 'NO',
    //   'operation:',
    //   data.operation
    // );

    if (panel && data.operation === 'render') {
      panel.totalRenderTime += data.duration || 0;
      panel.renderOperations.push({
        duration: data.duration || 0,
        timestamp: data.timestamp,
      });
      writePerformanceLog(
        'DashboardAnalyticsAggregator',
        '🔍 Recorded render operation, totalRenderTime now:',
        panel.totalRenderTime
      );
    }
  }

  // Query-level events
  onQueryStart(data: QueryPerformanceData): void {
    // Start events don't need aggregation, but ensure panel exists
    // Note: Query events don't have panelKey, need to find panel by panelId
    const panel = this.findPanelByPanelId(data.panelId);
    if (!panel) {
      console.warn('Panel not found for query start:', data.panelId);
    }
  }

  onQueryComplete(data: QueryPerformanceData): void {
    writePerformanceLog('DashboardAnalyticsAggregator', '🔍 onQueryComplete called with:', data);
    // Find the panel this query belongs to (queries have panelId but not panelKey)
    const panel = this.findPanelByPanelId(data.panelId);
    if (!panel) {
      // Query completed before panel was tracked, skip
      return;
    }

    const duration = data.duration || 0;
    panel.totalQueryTime += duration;
    panel.queryOperations.push({
      duration,
      timestamp: data.timestamp,
      queryType: data.queryType,
      seriesCount: data.seriesCount,
      dataPointsCount: data.dataPointsCount,
    });
  }

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
   * Find panel by panelId (used for queries which don't have panelKey)
   */
  private findPanelByPanelId(panelId: string): PanelAnalyticsMetrics | undefined {
    for (const panel of this.panelMetrics.values()) {
      if (panel.panelId === panelId) {
        return panel;
      }
    }
    return undefined;
  }

  /**
   * Send analytics report - replicates the logic from getDashboardInteractionCallback
   */
  private sendAnalyticsReport(data: PerformanceEventData): void {
    const payload = {
      duration: data.duration || 0,
      networkDuration: data.networkDuration || 0, // TODO: Calculate network duration from data
      processingTime: data.duration || 0,
      startTs: data.timestamp,
      endTs: data.timestamp + (data.duration || 0),
      totalJSHeapSize: performance.memory?.totalJSHeapSize || 0,
      usedJSHeapSize: performance.memory?.usedJSHeapSize || 0,
      jsHeapSizeLimit: performance.memory?.jsHeapSizeLimit || 0,
      timeSinceBoot: performance.measure('time_since_boot', 'frontend_boot_js_done_time_seconds').duration,
      longFramesCount: data.longFramesCount,
      longFramesTotalTime: data.longFramesTotalTime,
    };

    const panelMetrics = this.getPanelMetrics();

    // S4.0/S5.0: Log complete analytics event including panel metrics
    this.logDashboardAnalyticsEvent(data, payload, panelMetrics);

    writePerformanceLog('DashboardAnalyticsAggregator', 'Analytics payload:', payload);

    // Send the same analytics as before
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
    data: PerformanceEventData,
    payload: Record<string, unknown>,
    panelMetrics: PanelAnalyticsMetrics[] | null
  ): void {
    // Calculate performance insights if panel metrics are available
    let performanceInsights = null;
    if (panelMetrics && panelMetrics.length > 0) {
      const totalPanelTime = panelMetrics.reduce((sum: number, panel) => {
        const panelTotal =
          panel.totalQueryTime +
          panel.totalFieldConfigTime +
          panel.totalTransformationTime +
          panel.totalRenderTime +
          panel.pluginLoadTime;
        return sum + panelTotal;
      }, 0);

      const avgPanelTime = totalPanelTime / panelMetrics.length;

      const slowestPanel = panelMetrics.reduce((slowest, panel) => {
        const panelTotal =
          panel.totalQueryTime +
          panel.totalFieldConfigTime +
          panel.totalTransformationTime +
          panel.totalRenderTime +
          panel.pluginLoadTime;
        const slowestTotal =
          slowest.totalQueryTime +
          slowest.totalFieldConfigTime +
          slowest.totalTransformationTime +
          slowest.totalRenderTime +
          slowest.pluginLoadTime;

        return panelTotal > slowestTotal ? panel : slowest;
      });

      const slowestPanelTime =
        slowestPanel.totalQueryTime +
        slowestPanel.totalFieldConfigTime +
        slowestPanel.totalTransformationTime +
        slowestPanel.totalRenderTime +
        slowestPanel.pluginLoadTime;

      performanceInsights = {
        totalPanelTime: `${totalPanelTime.toFixed(2)}ms`,
        averagePanelTime: `${avgPanelTime.toFixed(2)}ms`,
        slowestPanel: {
          panelId: slowestPanel.panelId,
          pluginId: slowestPanel.pluginId,
          time: `${slowestPanelTime.toFixed(2)}ms`,
        },
      };
    }

    writePerformanceLog('DashboardAnalyticsAggregator', '🎯 Dashboard Analytics Event:', {
      uid: this.dashboardUID,
      title: this.dashboardTitle,
      interactionType: data.interactionType,
      dashboardMetrics: payload,
      panelMetricsMapSize: this.panelMetrics.size,
      panelMetricsArrayLength: panelMetrics?.length || 0,
      panelMetrics: (panelMetrics?.length ?? 0) > 0 ? panelMetrics : 'No panel metrics found',
      performanceInsights: performanceInsights || 'No performance insights available',
    });
  }
}

// Singleton instance
let dashboardAnalyticsAggregator: DashboardAnalyticsAggregator | null = null;

export function getDashboardAnalyticsAggregator(): DashboardAnalyticsAggregator {
  if (!dashboardAnalyticsAggregator) {
    dashboardAnalyticsAggregator = new DashboardAnalyticsAggregator();
  }
  return dashboardAnalyticsAggregator;
}

export function initializeDashboardAnalyticsAggregator(uid: string, title: string): void {
  getDashboardAnalyticsAggregator().initialize(uid, title);
}

export function destroyDashboardAnalyticsAggregator(): void {
  if (dashboardAnalyticsAggregator) {
    dashboardAnalyticsAggregator.destroy();
    dashboardAnalyticsAggregator = null;
  }
}
