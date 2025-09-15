// Standardized performance mark names for Scene operations
export const PERFORMANCE_MARKS = {
  // Panel operations
  PANEL_QUERY_START: (panelKey: string, operationId?: string) =>
    operationId ? `scenes.panel.query.start.${panelKey}.${operationId}` : `scenes.panel.query.start.${panelKey}`,
  PANEL_QUERY_END: (panelKey: string, operationId?: string) =>
    operationId ? `scenes.panel.query.end.${panelKey}.${operationId}` : `scenes.panel.query.end.${panelKey}`,
  PANEL_PLUGIN_LOAD_START: (panelKey: string, operationId?: string) =>
    operationId
      ? `scenes.panel.pluginLoad.start.${panelKey}.${operationId}`
      : `scenes.panel.pluginLoad.start.${panelKey}`,
  PANEL_PLUGIN_LOAD_END: (panelKey: string, operationId?: string) =>
    operationId ? `scenes.panel.pluginLoad.end.${panelKey}.${operationId}` : `scenes.panel.pluginLoad.end.${panelKey}`,
  PANEL_FIELD_CONFIG_START: (panelKey: string, operationId?: string) =>
    operationId
      ? `scenes.panel.fieldConfig.start.${panelKey}.${operationId}`
      : `scenes.panel.fieldConfig.start.${panelKey}`,
  PANEL_FIELD_CONFIG_END: (panelKey: string, operationId?: string) =>
    operationId
      ? `scenes.panel.fieldConfig.end.${panelKey}.${operationId}`
      : `scenes.panel.fieldConfig.end.${panelKey}`,
  PANEL_RENDER_START: (panelKey: string, operationId?: string) =>
    operationId ? `scenes.panel.render.start.${panelKey}.${operationId}` : `scenes.panel.render.start.${panelKey}`,
  PANEL_RENDER_END: (panelKey: string, operationId?: string) =>
    operationId ? `scenes.panel.render.end.${panelKey}.${operationId}` : `scenes.panel.render.end.${panelKey}`,
  PANEL_TRANSFORM_START: (panelKey: string, transformationId: string, operationId?: string) =>
    operationId
      ? `scenes.panel.transform.start.${panelKey}.${transformationId}.${operationId}`
      : `scenes.panel.transform.start.${panelKey}.${transformationId}`,
  PANEL_TRANSFORM_END: (panelKey: string, transformationId: string, operationId?: string) =>
    operationId
      ? `scenes.panel.transform.end.${panelKey}.${transformationId}.${operationId}`
      : `scenes.panel.transform.end.${panelKey}.${transformationId}`,
  PANEL_TRANSFORM_ERROR: (panelKey: string, transformationId: string, operationId?: string) =>
    operationId
      ? `scenes.panel.transform.error.${panelKey}.${transformationId}.${operationId}`
      : `scenes.panel.transform.error.${panelKey}.${transformationId}`,

  // Dashboard operations
  DASHBOARD_INTERACTION_START: (operationId: string) => `scenes.dashboard.interaction.start.${operationId}`,
  DASHBOARD_INTERACTION_END: (operationId: string) => `scenes.dashboard.interaction.end.${operationId}`,
  DASHBOARD_MILESTONE: (operationId: string, milestone: string) =>
    `scenes.dashboard.milestone.${milestone}.${operationId}`,

  // Query operations
  QUERY_START: (panelId: string, queryId: string) => `scenes.query.start.${panelId}.${queryId}`,
  QUERY_END: (panelId: string, queryId: string) => `scenes.query.end.${panelId}.${queryId}`,
};

// Standardized performance measure names
export const PERFORMANCE_MEASURES = {
  // Panel operations
  PANEL_QUERY: (panelKey: string, operationId?: string) =>
    operationId ? `scenes.panel.query.duration.${panelKey}.${operationId}` : `scenes.panel.query.duration.${panelKey}`,
  PANEL_PLUGIN_LOAD: (panelKey: string, operationId?: string) =>
    operationId
      ? `scenes.panel.pluginLoad.duration.${panelKey}.${operationId}`
      : `scenes.panel.pluginLoad.duration.${panelKey}`,
  PANEL_FIELD_CONFIG: (panelKey: string, operationId?: string) =>
    operationId
      ? `scenes.panel.fieldConfig.duration.${panelKey}.${operationId}`
      : `scenes.panel.fieldConfig.duration.${panelKey}`,
  PANEL_RENDER: (panelKey: string, operationId?: string) =>
    operationId
      ? `scenes.panel.render.duration.${panelKey}.${operationId}`
      : `scenes.panel.render.duration.${panelKey}`,
  PANEL_TRANSFORM: (panelKey: string, transformationId: string, operationId?: string) =>
    operationId
      ? `scenes.panel.transform.duration.${panelKey}.${transformationId}.${operationId}`
      : `scenes.panel.transform.duration.${panelKey}.${transformationId}`,

  // Dashboard operations
  DASHBOARD_INTERACTION: (operationId: string) => `scenes.dashboard.interaction.duration.${operationId}`,

  // Query operations
  QUERY: (panelId: string, queryId: string) => `scenes.query.duration.${panelId}.${queryId}`,
};

/**
 * Safely creates a performance mark, ignoring errors if the Performance API is not available.
 */
export function createPerformanceMark(name: string, timestamp?: number): void {
  try {
    if (typeof performance !== 'undefined' && performance.mark) {
      if (timestamp !== undefined) {
        performance.mark(name, { startTime: timestamp });
      } else {
        performance.mark(name);
      }
      console.log(`🎯 Created performance mark: ${name}`, { timestamp });
    }
  } catch (error) {
    console.error(`❌ Failed to create performance mark: ${name}`, { timestamp, error });
  }
}

/**
 * Safely creates a performance measure, ignoring errors if the Performance API is not available.
 */
export function createPerformanceMeasure(name: string, startMark: string, endMark?: string): void {
  try {
    if (typeof performance !== 'undefined' && performance.measure) {
      if (endMark) {
        performance.measure(name, startMark, endMark);
      } else {
        performance.measure(name, startMark);
      }
      console.log(`✅ Created performance measure: ${name}`, { startMark, endMark });
    }
  } catch (error) {
    console.error(`❌ Failed to create performance measure: ${name}`, { startMark, endMark, error });
  }
}
