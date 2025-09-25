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

import {
  PERFORMANCE_MARKS,
  PERFORMANCE_MEASURES,
  createPerformanceMark,
  createPerformanceMeasure,
} from './performanceConstants';

/**
 * Grafana service that subscribes to Scene performance events
 * and integrates them with Grafana's observability systems.
 * Also creates Chrome DevTools performance marks and measurements for debugging.
 */
export class ScenePerformanceService implements ScenePerformanceObserver {
  private isInitialized = false;
  private unsubscribe: (() => void) | null = null;

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

  public initialize() {
    if (this.isInitialized) {
      return;
    }

    // Subscribe to Scene performance events
    const tracker = getScenePerformanceTracker();
    this.unsubscribe = tracker.addObserver(this);

    // Note: Analytics aggregator will be initialized separately with dashboard context

    this.isInitialized = true;
    writePerformanceLog('ScenePerformanceService', 'Initialized and subscribed to Scene performance events');
  }

  public destroy() {
    if (!this.isInitialized) {
      return;
    }

    // Unsubscribe from Scene performance events
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.isInitialized = false;
    writePerformanceLog('ScenePerformanceService', 'Destroyed and unsubscribed from Scene performance events');
  }

  // Dashboard-level events
  onDashboardInteractionStart(data: DashboardInteractionStartData): void {
    // Create standardized dashboard performance mark
    const dashboardStartMark = PERFORMANCE_MARKS.DASHBOARD_INTERACTION_START(data.operationId);
    createPerformanceMark(dashboardStartMark, data.timestamp);

    writePerformanceLog('ScenePerformanceService', '🎯 Dashboard Interaction Started:', {
      type: data.interactionType,
      uid: data.metadata?.dashboardUID,
      title: data.metadata?.dashboardTitle,
      panelCount: data.metadata?.panelCount,
      timestamp: data.timestamp,
      operationId: data.operationId,
    });
  }

  onDashboardInteractionMilestone(data: DashboardInteractionMilestoneData): void {
    // Create standardized dashboard milestone mark
    const milestone = data.milestone || 'unknown';
    const dashboardMilestoneMark = PERFORMANCE_MARKS.DASHBOARD_MILESTONE(data.operationId, milestone);
    createPerformanceMark(dashboardMilestoneMark, data.timestamp);

    writePerformanceLog('ScenePerformanceService', '🔄 Dashboard Milestone:', {
      type: data.interactionType,
      uid: data.metadata?.dashboardUID,
      milestone: data.milestone,
      timestamp: data.timestamp,
      operationId: data.operationId,
    });
  }

  onDashboardInteractionComplete(data: DashboardInteractionCompleteData): void {
    // Create standardized dashboard performance marks and measure
    const dashboardEndMark = PERFORMANCE_MARKS.DASHBOARD_INTERACTION_END(data.operationId);
    const dashboardStartMark = PERFORMANCE_MARKS.DASHBOARD_INTERACTION_START(data.operationId);
    const dashboardMeasureName = PERFORMANCE_MEASURES.DASHBOARD_INTERACTION(data.operationId);

    createPerformanceMark(dashboardEndMark, data.timestamp);
    createPerformanceMeasure(dashboardMeasureName, dashboardStartMark, dashboardEndMark);

    writePerformanceLog('ScenePerformanceService', '✅ Dashboard Interaction Complete:', {
      type: data.interactionType,
      uid: data.metadata?.dashboardUID,
      title: data.metadata?.dashboardTitle,
      duration: data.duration,
      networkDuration: data.networkDuration,
      timestamp: data.timestamp,
      operationId: data.operationId,
    });
  }

  // Panel-level events
  onPanelOperationStart(data: PanelPerformanceData): void {
    // Create standardized performance marks based on operation type
    this.createStandardizedPanelMark(data, 'start');

    const operationIcon = this.getOperationIcon(data.operation);
    writePerformanceLog('ScenePerformanceService', `${operationIcon} Panel Operation Started [${data.operation}]:`, {
      panelId: data.panelId,
      panelKey: data.panelKey,
      pluginId: data.pluginId,
      operation: data.operation,
      timestamp: data.timestamp,
      metadata: data.metadata,
      operationId: data.operationId,
    });
  }

  onPanelOperationComplete(data: PanelPerformanceData): void {
    // Create standardized performance marks and measures based on operation type
    this.createStandardizedPanelMark(data, 'end');
    this.createStandardizedPanelMeasure(data);

    const operationIcon = this.getOperationIcon(data.operation);
    writePerformanceLog('ScenePerformanceService', `${operationIcon} Panel Operation Complete [${data.operation}]:`, {
      panelId: data.panelId,
      panelKey: data.panelKey,
      pluginId: data.pluginId,
      operation: data.operation,
      duration: data.duration,
      timestamp: data.timestamp,
      metadata: data.metadata,
      operationId: data.operationId,
    });
  }

  // Query-level events
  onQueryStart(data: QueryPerformanceData): void {
    // Create standardized query performance mark for non-panel queries
    const queryStartMark = PERFORMANCE_MARKS.QUERY_START(data.origin, data.queryId);
    createPerformanceMark(queryStartMark, data.timestamp);

    writePerformanceLog('ScenePerformanceService', '📊 Non-Panel Query Started:', {
      queryId: data.queryId,
      queryType: data.queryType,
      querySource: data.querySource,
      origin: data.origin,
      timestamp: data.timestamp,
      operationId: data.operationId,
    });
  }

  onQueryComplete(data: QueryPerformanceData): void {
    // Create standardized query performance marks and measure for non-panel queries
    const queryEndMark = PERFORMANCE_MARKS.QUERY_END(data.origin, data.queryId);
    const queryStartMark = PERFORMANCE_MARKS.QUERY_START(data.origin, data.queryId);
    const queryMeasureName = PERFORMANCE_MEASURES.QUERY(data.origin, data.queryId);

    createPerformanceMark(queryEndMark, data.timestamp);
    createPerformanceMeasure(queryMeasureName, queryStartMark, queryEndMark);

    writePerformanceLog('ScenePerformanceService', '📊 Non-Panel Query Complete:', {
      queryId: data.queryId,
      queryType: data.queryType,
      querySource: data.querySource,
      origin: data.origin,
      duration: data.duration,
      timestamp: data.timestamp,
      operationId: data.operationId,
    });
  }

  // Standardized performance mark creation methods - now with full type safety!
  private createStandardizedPanelMark(data: PanelPerformanceData, phase: 'start' | 'end'): void {
    const { operation, panelKey, operationId } = data;

    switch (operation) {
      case 'query':
        const markName =
          phase === 'start'
            ? PERFORMANCE_MARKS.PANEL_QUERY_START(panelKey, operationId)
            : PERFORMANCE_MARKS.PANEL_QUERY_END(panelKey, operationId);
        createPerformanceMark(markName, data.timestamp);
        break;

      case 'plugin-load':
        const pluginMarkName =
          phase === 'start'
            ? PERFORMANCE_MARKS.PANEL_PLUGIN_LOAD_START(panelKey, operationId)
            : PERFORMANCE_MARKS.PANEL_PLUGIN_LOAD_END(panelKey, operationId);
        createPerformanceMark(pluginMarkName, data.timestamp);
        break;

      case 'fieldConfig':
        const fieldConfigMarkName =
          phase === 'start'
            ? PERFORMANCE_MARKS.PANEL_FIELD_CONFIG_START(panelKey, operationId)
            : PERFORMANCE_MARKS.PANEL_FIELD_CONFIG_END(panelKey, operationId);
        createPerformanceMark(fieldConfigMarkName, data.timestamp);
        break;

      case 'render':
        const renderMarkName =
          phase === 'start'
            ? PERFORMANCE_MARKS.PANEL_RENDER_START(panelKey, operationId)
            : PERFORMANCE_MARKS.PANEL_RENDER_END(panelKey, operationId);
        createPerformanceMark(renderMarkName, data.timestamp);
        break;

      case 'transform':
        // ✅ TypeScript now knows this is PanelTransformPerformanceData!
        // ✅ No manual type guards needed - metadata.transformationId is guaranteed to be string!
        const transformationId = data.metadata.transformationId;
        if (phase === 'start') {
          createPerformanceMark(
            PERFORMANCE_MARKS.PANEL_TRANSFORM_START(panelKey, transformationId, operationId),
            data.timestamp
          );
        } else {
          // ✅ TypeScript knows metadata has success, error, etc. properties
          const isError = data.metadata.error || data.metadata.success === false;
          const transformEndMarkName = isError
            ? PERFORMANCE_MARKS.PANEL_TRANSFORM_ERROR(panelKey, transformationId, operationId)
            : PERFORMANCE_MARKS.PANEL_TRANSFORM_END(panelKey, transformationId, operationId);
          createPerformanceMark(transformEndMarkName, data.timestamp);
        }
        break;

      default:
        break;
    }
  }

  private createStandardizedPanelMeasure(data: PanelPerformanceData): void {
    const { operation, panelKey, operationId } = data;

    switch (operation) {
      case 'query':
        const startMark = PERFORMANCE_MARKS.PANEL_QUERY_START(panelKey, operationId);
        const endMark = PERFORMANCE_MARKS.PANEL_QUERY_END(panelKey, operationId);
        const measureName = PERFORMANCE_MEASURES.PANEL_QUERY(panelKey, operationId);
        createPerformanceMeasure(measureName, startMark, endMark);
        break;

      case 'plugin-load':
        const pluginStartMark = PERFORMANCE_MARKS.PANEL_PLUGIN_LOAD_START(panelKey, operationId);
        const pluginEndMark = PERFORMANCE_MARKS.PANEL_PLUGIN_LOAD_END(panelKey, operationId);
        const pluginMeasureName = PERFORMANCE_MEASURES.PANEL_PLUGIN_LOAD(panelKey, operationId);
        createPerformanceMeasure(pluginMeasureName, pluginStartMark, pluginEndMark);
        break;

      case 'fieldConfig':
        const fieldConfigStartMark = PERFORMANCE_MARKS.PANEL_FIELD_CONFIG_START(panelKey, operationId);
        const fieldConfigEndMark = PERFORMANCE_MARKS.PANEL_FIELD_CONFIG_END(panelKey, operationId);
        const fieldConfigMeasureName = PERFORMANCE_MEASURES.PANEL_FIELD_CONFIG(panelKey, operationId);
        createPerformanceMeasure(fieldConfigMeasureName, fieldConfigStartMark, fieldConfigEndMark);
        break;

      case 'render':
        const renderStartMark = PERFORMANCE_MARKS.PANEL_RENDER_START(panelKey, operationId);
        const renderEndMark = PERFORMANCE_MARKS.PANEL_RENDER_END(panelKey, operationId);
        const renderMeasureName = PERFORMANCE_MEASURES.PANEL_RENDER(panelKey, operationId);
        createPerformanceMeasure(renderMeasureName, renderStartMark, renderEndMark);
        break;

      case 'transform':
        // ✅ TypeScript now knows this is PanelTransformPerformanceData!
        // ✅ No manual type guards needed - metadata.transformationId is guaranteed to be string!
        const transformationId = data.metadata.transformationId;
        const transformStartMark = PERFORMANCE_MARKS.PANEL_TRANSFORM_START(panelKey, transformationId, operationId);

        // ✅ TypeScript knows metadata has success, error, etc. properties
        const isError = data.metadata.error || data.metadata.success === false;
        const transformEndMark = isError
          ? PERFORMANCE_MARKS.PANEL_TRANSFORM_ERROR(panelKey, transformationId, operationId)
          : PERFORMANCE_MARKS.PANEL_TRANSFORM_END(panelKey, transformationId, operationId);

        const transformMeasureName = PERFORMANCE_MEASURES.PANEL_TRANSFORM(panelKey, transformationId, operationId);
        createPerformanceMeasure(transformMeasureName, transformStartMark, transformEndMark);
        break;

      default:
        break;
    }
  }

  // Helper method to get appropriate icon for operation type
  private getOperationIcon(operation: string): string {
    switch (operation) {
      case 'query':
        return '🔍';
      case 'transform':
        return '🔄';
      case 'fieldConfig':
        return '🔧';
      case 'render':
        return '🎨';
      case 'plugin-load':
        return '⚡';
      default:
        return '⚡';
    }
  }

  // All performance marks now use standardized functions from performanceConstants.ts
}

// Singleton instance
let scenePerformanceService: ScenePerformanceService | null = null;

export function getScenePerformanceService(): ScenePerformanceService {
  if (!scenePerformanceService) {
    scenePerformanceService = new ScenePerformanceService();
  }
  return scenePerformanceService;
}

export function initializeScenePerformanceService(): void {
  getScenePerformanceService().initialize();
}

export function destroyScenePerformanceService(): void {
  if (scenePerformanceService) {
    scenePerformanceService.destroy();
    scenePerformanceService = null;
  }
}
