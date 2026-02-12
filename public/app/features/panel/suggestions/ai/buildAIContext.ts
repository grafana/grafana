import { DataFrame, FieldType, PanelData, PanelPluginMeta, PluginState } from '@grafana/data';
import { DataSourceRef } from '@grafana/schema';
import { config } from '@grafana/runtime';

import {
  AISuggestionContext,
  DataSummary,
  DatasourceInfo,
  FieldInfo,
  QueryMetadata,
  VisualizationInfo,
} from './types';

const MAX_FRAMES = 3;
const MAX_SAMPLE_VALUES = 3;

/**
 * Build the data summary from series
 */
function buildDataSummary(series: DataFrame[]): DataSummary {
  let rowCountTotal = 0;
  let rowCountMax = 0;
  let fieldCount = 0;

  for (const frame of series) {
    rowCountTotal += frame.length;
    rowCountMax = Math.max(rowCountMax, frame.length);
    fieldCount += frame.fields.length;
  }

  // Determine if this is instant data (single row per frame)
  const isInstant = series.length > 0 && series.every((frame) => frame.length <= 1);

  return {
    rowCountTotal,
    rowCountMax,
    fieldCount,
    frameCount: series.length,
    isInstant,
  };
}

/**
 * Extract field information with sample values from series
 */
function extractFieldInfo(series: DataFrame[]): FieldInfo[] {
  const fields: FieldInfo[] = [];
  const framesToProcess = series.slice(0, MAX_FRAMES);

  for (const frame of framesToProcess) {
    for (const field of frame.fields) {
      // Get sample values (first 3)
      const sampleValues: unknown[] = [];
      for (let i = 0; i < Math.min(field.values.length, MAX_SAMPLE_VALUES); i++) {
        sampleValues.push(field.values[i]);
      }

      fields.push({
        name: field.name,
        type: FieldType[field.type] ?? field.type,
        sampleValues,
      });
    }
  }

  return fields;
}

/**
 * Extract datasource information from panel data
 */
function getDatasourceInfo(data: PanelData): DatasourceInfo[] {
  const targets = data.request?.targets ?? [];
  const dsMap = new Map<string, DatasourceInfo>();

  for (const target of targets) {
    const ds = target.datasource as DataSourceRef | undefined;
    if (ds?.type && !dsMap.has(ds.type)) {
      dsMap.set(ds.type, { type: ds.type });
    }
  }

  // If no datasources found, return unknown
  if (dsMap.size === 0) {
    return [{ type: 'unknown' }];
  }

  return Array.from(dsMap.values());
}

/**
 * Extract query metadata from panel data
 */
function getQueryMetadata(data: PanelData): QueryMetadata {
  const targets = data.request?.targets ?? [];

  // Extract query types from targets
  const queryTypes = [...new Set(targets.map((t) => t.queryType).filter((qt): qt is string => Boolean(qt)))];

  // Extract preferred visualization types from series metadata
  const preferredVizTypes = [
    ...new Set(
      data.series
        .map((s) => s.meta?.preferredVisualisationType)
        .filter((vt): vt is string => Boolean(vt))
    ),
  ];

  // Extract data frame types from series metadata
  const dataFrameTypes = [
    ...new Set(data.series.map((s) => s.meta?.type).filter((t): t is string => Boolean(t))),
  ];

  return {
    queryTypes,
    preferredVizTypes,
    dataFrameTypes,
  };
}

/**
 * Get filtered list of available panel plugins for AI context
 */
export function getFilteredPanelPlugins(): PanelPluginMeta[] {
  const allPanels = config.panels;

  return Object.values(allPanels).filter(
    (panel) =>
      !panel.hideFromList && // Not hidden
      panel.state !== PluginState.deprecated && // Not deprecated
      !panel.skipDataQuery // Data visualization (not widget)
  );
}

/**
 * Map panel plugins to visualization info for AI context
 */
function mapToVisualizationInfo(plugins: PanelPluginMeta[]): VisualizationInfo[] {
  return plugins.map((panel) => ({
    id: panel.id,
    name: panel.name,
    description: panel.info?.description ?? '',
  }));
}

/**
 * Build the complete AI suggestion context
 */
export function buildAIContext(
  data: PanelData,
  panelState: 'new' | 'editing',
  currentVisualization?: string
): AISuggestionContext {
  const series = data.series ?? [];
  const plugins = getFilteredPanelPlugins();

  return {
    dataSummary: buildDataSummary(series),
    fields: extractFieldInfo(series),
    datasources: getDatasourceInfo(data),
    queryMetadata: getQueryMetadata(data),
    panelState,
    currentVisualization,
    availableVisualizations: mapToVisualizationInfo(plugins),
  };
}

/**
 * Build a user prompt string from the AI context
 */
export function buildUserPrompt(context: AISuggestionContext): string {
  const parts: string[] = [];

  // Data summary
  parts.push('## Data Summary');
  parts.push(`- Frames: ${context.dataSummary.frameCount}`);
  parts.push(`- Total rows: ${context.dataSummary.rowCountTotal}`);
  parts.push(`- Max rows per frame: ${context.dataSummary.rowCountMax}`);
  parts.push(`- Total fields: ${context.dataSummary.fieldCount}`);
  parts.push(`- Instant query: ${context.dataSummary.isInstant}`);
  parts.push('');

  // Fields
  if (context.fields.length > 0) {
    parts.push('## Fields');
    for (const field of context.fields) {
      const samples = field.sampleValues.map((v) => JSON.stringify(v)).join(', ');
      parts.push(`- ${field.name} (${field.type}): [${samples}]`);
    }
    parts.push('');
  }

  // Datasources
  parts.push('## Datasources');
  for (const ds of context.datasources) {
    parts.push(`- ${ds.type}`);
  }
  parts.push('');

  // Query metadata
  if (context.queryMetadata.queryTypes.length > 0 || context.queryMetadata.preferredVizTypes.length > 0) {
    parts.push('## Query Hints');
    if (context.queryMetadata.queryTypes.length > 0) {
      parts.push(`- Query types: ${context.queryMetadata.queryTypes.join(', ')}`);
    }
    if (context.queryMetadata.preferredVizTypes.length > 0) {
      parts.push(`- Preferred viz types: ${context.queryMetadata.preferredVizTypes.join(', ')}`);
    }
    if (context.queryMetadata.dataFrameTypes.length > 0) {
      parts.push(`- Data frame types: ${context.queryMetadata.dataFrameTypes.join(', ')}`);
    }
    parts.push('');
  }

  // Panel state
  parts.push('## Panel State');
  parts.push(`- State: ${context.panelState}`);
  if (context.currentVisualization) {
    parts.push(`- Current visualization: ${context.currentVisualization}`);
  }
  parts.push('');

  // Available visualizations
  parts.push('## Available Visualizations');
  for (const viz of context.availableVisualizations) {
    const desc = viz.description ? ` - ${viz.description}` : '';
    parts.push(`- ${viz.id}: ${viz.name}${desc}`);
  }

  return parts.join('\n');
}
