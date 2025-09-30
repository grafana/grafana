import { logMeasurement, reportInteraction } from '@grafana/runtime';
import {
  type ScenePerformanceObserver,
  type DashboardInteractionStartData,
  type DashboardInteractionMilestoneData,
  type DashboardInteractionCompleteData,
  type PanelPerformanceData,
  type QueryPerformanceData,
  getScenePerformanceTracker,
  writePerformanceLog,
} from '@grafana/scenes';

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
 * Replaces the complex PanelPerformanceCollector with a clean observer-based approach
 */
export class DashboardAnalyticsAggregator implements ScenePerformanceObserver {
  private panelMetrics = new Map<string, PanelAnalyticsMetrics>();
  private dashboardUID = '';
  private dashboardTitle = '';

  constructor() {
    // Bind all observer methods to preserve 'this' context when called by ScenePerformanceTracker
    this.onDashboardInteractionStart = this.onDashboardInteractionStart.bind(this);
    this.onDashboardInteractionMilestone = this.onDashboardInteractionMilestone.bind(this);
    this.onDashboardInteractionComplete = this.onDashboardInteractionComplete.bind(this);
    this.onPanelOperationStart = this.onPanelOperationStart.bind(this);
    this.onPanelOperationComplete = this.onPanelOperationComplete.bind(this);
    this.onQueryStart = this.onQueryStart.bind(this);
    this.onQueryComplete = this.onQueryComplete.bind(this);
  }

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
  onDashboardInteractionStart(data: DashboardInteractionStartData): void {
    // Clear metrics when new dashboard interaction starts
    this.clearMetrics();
  }

  onDashboardInteractionMilestone(data: DashboardInteractionMilestoneData): void {
    // No action needed for milestones in analytics
  }

  onDashboardInteractionComplete(data: DashboardInteractionCompleteData): void {
    // Send analytics report for dashboard interaction completion
    this.sendAnalyticsReport(data);
  }

  // Panel-level events
  onPanelOperationStart(data: PanelPerformanceData): void {
    // Start events don't need aggregation, just ensure panel exists
    this.ensurePanelExists(data.panelKey, data.panelId, data.pluginId, data.pluginVersion);
  }

  onPanelOperationComplete(data: PanelPerformanceData): void {
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
  }

  // Query-level events
  onQueryStart(data: QueryPerformanceData): void {
    // Non-panel queries (annotations, variables, plugins, datasources) don't need aggregation
    // These are infrastructure queries that don't belong to specific panels
    // Logging handled by ScenePerformanceLogger to avoid duplication
  }

  onQueryComplete(data: QueryPerformanceData): void {
    // Non-panel queries (annotations, variables, plugins, datasources) don't need panel aggregation
    // These are infrastructure queries that don't belong to specific panels
    // Logging handled by ScenePerformanceLogger to avoid duplication
    // Could track infrastructure query metrics separately in the future if needed
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
   * Send analytics report for dashboard interactions
   */
  private sendAnalyticsReport(data: DashboardInteractionCompleteData): void {
    const payload = {
      duration: data.duration || 0,
      networkDuration: data.networkDuration || 0, // TODO: Calculate network duration from data
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

    // Analytics payload logged separately if needed for debugging

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
    data: DashboardInteractionCompleteData,
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
          100
      ).length || 0;

    // eslint-disable-next-line no-console
    console.groupCollapsed(
      `DAA: [ANALYTICS] ${data.interactionType} | ${panelSummary}${slowPanelCount > 0 ? ` | ${slowPanelCount} slow panels ⚠️` : ''}`
    );

    // Dashboard overview
    console.log('📊 Dashboard:', {
      duration: `${(data.duration || 0).toFixed(1)}ms`,
      network: `${(data.networkDuration || 0).toFixed(1)}ms`,
      interactionType: data.interactionType,
      slowPanels: slowPanelCount,
    });

    // Analytics payload
    console.log('📈 Analytics payload:', payload);

    // Individual collapsible panel logs with detailed breakdown
    if (panelMetrics && panelMetrics.length > 0) {
      panelMetrics.forEach((panel) => {
        const totalPanelTime =
          panel.totalQueryTime +
          panel.totalTransformationTime +
          panel.totalRenderTime +
          panel.totalFieldConfigTime +
          panel.pluginLoadTime;

        const isSlowPanel = totalPanelTime > 100;
        const slowWarning = isSlowPanel ? ' ⚠️ SLOW' : '';

        // eslint-disable-next-line no-console
        console.groupCollapsed(
          `🎨 Panel ${panel.pluginId}-${panel.panelId}: ${totalPanelTime.toFixed(1)}ms total${slowWarning}`
        );

        console.log('🔧 Plugin:', {
          id: panel.pluginId,
          version: panel.pluginVersion || 'unknown',
          panelId: panel.panelId,
          panelKey: panel.panelKey,
        });

        console.log('⚡ Performance:', {
          totalTime: `${totalPanelTime.toFixed(1)}ms`,
          isSlowPanel: isSlowPanel,
          breakdown: {
            query: `${panel.totalQueryTime.toFixed(1)}ms`,
            transform: `${panel.totalTransformationTime.toFixed(1)}ms`,
            render: `${panel.totalRenderTime.toFixed(1)}ms`,
            fieldConfig: `${panel.totalFieldConfigTime.toFixed(1)}ms`,
            pluginLoad: `${panel.pluginLoadTime.toFixed(1)}ms`,
          },
        });

        if (panel.queryOperations.length > 0) {
          console.log('📊 Queries:', {
            count: panel.queryOperations.length,
            details: panel.queryOperations.map((op, index) => ({
              operation: index + 1,
              duration: `${op.duration.toFixed(1)}ms`,
              timestamp: op.timestamp,
              queryType: op.queryType || 'unknown',
            })),
          });
        }

        if (panel.transformationOperations.length > 0) {
          console.log('🔄 Transformations:', {
            count: panel.transformationOperations.length,
            details: panel.transformationOperations.map((op, index) => ({
              operation: index + 1,
              duration: `${op.duration.toFixed(1)}ms`,
              timestamp: op.timestamp,
              transformationId: op.transformationId || 'unknown',
              success: op.success !== false,
            })),
          });
        }

        if (panel.renderOperations.length > 0) {
          console.log('🎨 Renders:', {
            count: panel.renderOperations.length,
            details: panel.renderOperations.map((op, index) => ({
              operation: index + 1,
              duration: `${op.duration.toFixed(1)}ms`,
              timestamp: op.timestamp,
            })),
          });
        }

        if (panel.fieldConfigOperations.length > 0) {
          console.log('⚙️ FieldConfigs:', {
            count: panel.fieldConfigOperations.length,
            details: panel.fieldConfigOperations.map((op, index) => ({
              operation: index + 1,
              duration: `${op.duration.toFixed(1)}ms`,
              timestamp: op.timestamp,
            })),
          });
        }

        // eslint-disable-next-line no-console
        console.groupEnd();
      });
    }

    // eslint-disable-next-line no-console
    console.groupEnd();
  }
}

// Global singleton instance with lazy initialization
let dashboardAnalyticsAggregator: DashboardAnalyticsAggregator | null = null;

export function initialiseDashboardAnalyticsAggregator(): DashboardAnalyticsAggregator {
  if (!dashboardAnalyticsAggregator) {
    dashboardAnalyticsAggregator = new DashboardAnalyticsAggregator();

    // Register as global performance observer on first access
    const tracker = getScenePerformanceTracker();
    tracker.addObserver(dashboardAnalyticsAggregator);

    writePerformanceLog('DAA', 'Initialized globally and registered as performance observer');
  }
  return dashboardAnalyticsAggregator;
}

export function getDashboardAnalyticsAggregator(): DashboardAnalyticsAggregator {
  return initialiseDashboardAnalyticsAggregator();
}
