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
 * Grafana logger that subscribes to Scene performance events
 * and logs them to console with Chrome DevTools performance marks and measurements for debugging.
 */
export class ScenePerformanceLogger implements ScenePerformanceObserver {
  private panelGroupsOpen = new Set<string>(); // Track which panels we've seen

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
    // Initialization is now handled by singleton pattern in initialiseScenePerformanceLogger()
    writePerformanceLog('SPL', 'Performance logger ready');
  }

  public destroy() {
    // Clear any tracking state for testing
    this.panelGroupsOpen.clear();
    writePerformanceLog('SPL', 'Performance logger state cleared');
  }

  // Dashboard-level events
  onDashboardInteractionStart(data: DashboardInteractionStartData): void {
    // Create standardized dashboard performance mark
    const dashboardStartMark = PERFORMANCE_MARKS.DASHBOARD_INTERACTION_START(data.operationId);
    createPerformanceMark(dashboardStartMark, data.timestamp);

    const title = data.metadata?.dashboardTitle || 'Unknown Dashboard';

    writePerformanceLog('SPL', `[DASHBOARD] ${data.interactionType} started: ${title}`);
  }

  onDashboardInteractionMilestone(data: DashboardInteractionMilestoneData): void {
    // Create standardized dashboard milestone mark
    const milestone = data.milestone || 'unknown';
    const dashboardMilestoneMark = PERFORMANCE_MARKS.DASHBOARD_MILESTONE(data.operationId, milestone);
    createPerformanceMark(dashboardMilestoneMark, data.timestamp);

    // Log milestones quietly - only when verbose debugging is needed
    // Most milestones are covered by the start/complete query logs
  }

  onDashboardInteractionComplete(data: DashboardInteractionCompleteData): void {
    // Create standardized dashboard performance marks and measure
    const dashboardEndMark = PERFORMANCE_MARKS.DASHBOARD_INTERACTION_END(data.operationId);
    const dashboardStartMark = PERFORMANCE_MARKS.DASHBOARD_INTERACTION_START(data.operationId);
    const dashboardMeasureName = PERFORMANCE_MEASURES.DASHBOARD_INTERACTION(data.operationId);

    createPerformanceMark(dashboardEndMark, data.timestamp);
    createPerformanceMeasure(dashboardMeasureName, dashboardStartMark, dashboardEndMark);

    // Clear tracking state
    this.panelGroupsOpen.clear();

    // Dashboard completion logging is handled comprehensively by SceneRenderProfiler
    // This observer focuses on creating DevTools performance marks/measures
  }

  // Panel-level events
  onPanelOperationStart(data: PanelPerformanceData): void {
    // Create standardized performance marks based on operation type
    this.createStandardizedPanelMark(data, 'start');

    // Track panel for summary logging later
    this.panelGroupsOpen.add(data.panelKey);

    // Don't log start events - they're noise. Only log completions with timing.
  }

  onPanelOperationComplete(data: PanelPerformanceData): void {
    // Create standardized performance marks and measures based on operation type
    this.createStandardizedPanelMark(data, 'end');
    this.createStandardizedPanelMeasure(data);

    const duration = (data.duration || 0).toFixed(1);
    const slowWarning = (data.duration || 0) > 100 ? ' ⚠️ SLOW' : '';

    // For query operations, include the queryId for correlation
    let operationDisplay: string = data.operation;
    if (data.operation === 'query') {
      operationDisplay = `${data.operation} [${data.metadata.queryId}]`;
    }

    writePerformanceLog(
      'SPL',
      `[PANEL] ${data.pluginId}-${data.panelId} ${operationDisplay}: ${duration}ms${slowWarning}`
    );
  }

  // Query-level events
  onQueryStart(data: QueryPerformanceData): void {
    // Create standardized query performance mark for non-panel queries
    const queryStartMark = PERFORMANCE_MARKS.QUERY_START(data.origin, data.queryId);
    createPerformanceMark(queryStartMark, data.timestamp);

    // Mark that we're processing infrastructure queries

    // Don't log start events - they're noise. Only log completions with timing.
  }

  onQueryComplete(data: QueryPerformanceData): void {
    // Create standardized query performance marks and measure for non-panel queries
    const queryEndMark = PERFORMANCE_MARKS.QUERY_END(data.origin, data.queryId);
    const queryStartMark = PERFORMANCE_MARKS.QUERY_START(data.origin, data.queryId);
    const queryMeasureName = PERFORMANCE_MEASURES.QUERY(data.origin, data.queryId);

    createPerformanceMark(queryEndMark, data.timestamp);
    createPerformanceMeasure(queryMeasureName, queryStartMark, queryEndMark);

    const duration = (data.duration || 0).toFixed(1);
    const slowWarning = (data.duration || 0) > 100 ? ' ⚠️ SLOW' : '';

    // Simple, clean format
    const queryType = data.queryType.replace(/^(getDataSource\/|AnnotationsDataLayer\/)/, ''); // Remove prefixes
    writePerformanceLog('SPL', `[QUERY ${data.origin}] ${queryType} [${data.queryId}]: ${duration}ms${slowWarning}`);
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

  // All performance marks now use standardized functions from performanceConstants.ts
}

// Global singleton instance with lazy initialization
let scenePerformanceLogger: ScenePerformanceLogger | null = null;

export function initialiseScenePerformanceLogger(): ScenePerformanceLogger {
  if (!scenePerformanceLogger) {
    scenePerformanceLogger = new ScenePerformanceLogger();
    scenePerformanceLogger.initialize();

    // Register as global performance observer
    const tracker = getScenePerformanceTracker();
    tracker.addObserver(scenePerformanceLogger);

    writePerformanceLog('SPL', 'Initialized globally and registered as performance observer');
  }
  return scenePerformanceLogger;
}

export function getScenePerformanceLogger(): ScenePerformanceLogger {
  return initialiseScenePerformanceLogger();
}
