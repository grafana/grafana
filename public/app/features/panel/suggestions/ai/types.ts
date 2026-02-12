import { FieldConfigSource, PanelPluginVisualizationSuggestion } from '@grafana/data';

/**
 * Summary of the data shape for AI context
 */
export interface DataSummary {
  rowCountTotal: number;
  rowCountMax: number;
  fieldCount: number;
  frameCount: number;
  isInstant: boolean;
}

/**
 * Field information with sample values for AI context
 */
export interface FieldInfo {
  name: string;
  type: string; // 'time', 'number', 'string', etc.
  sampleValues: unknown[]; // First 3 values
}

/**
 * Datasource information for AI context
 */
export interface DatasourceInfo {
  type: string; // 'prometheus', 'loki', 'mysql', etc.
}

/**
 * Query metadata for AI context
 */
export interface QueryMetadata {
  queryTypes: string[]; // ['range'], ['instant'], ['logs']
  preferredVizTypes: string[]; // from datasource meta
  dataFrameTypes: string[]; // TimeSeriesWide, etc.
}

/**
 * Visualization info for AI context
 */
export interface VisualizationInfo {
  id: string;
  name: string;
  description: string;
}

/**
 * Complete context sent to AI for visualization suggestions
 */
export interface AISuggestionContext {
  dataSummary: DataSummary;
  fields: FieldInfo[];
  datasources: DatasourceInfo[];
  queryMetadata: QueryMetadata;
  panelState: 'new' | 'editing';
  currentVisualization?: string;
  availableVisualizations: VisualizationInfo[];
}

/**
 * Single visualization suggestion from AI
 */
export interface AIVisualizationSuggestion {
  pluginId: string;
  name: string;
  reason: string;
}

/**
 * Input for the suggest_visualizations tool
 */
export interface SuggestVisualizationsInput {
  suggestions: AIVisualizationSuggestion[];
}

/**
 * Enriched suggestion with options/fieldConfig from rule-based suggestions
 */
export interface EnrichedAISuggestion extends PanelPluginVisualizationSuggestion {
  reason?: string;
  isAISuggestion: true;
}

/**
 * Input for get_field_details tool
 */
export interface GetFieldDetailsInput {
  frameIndex: number;
}

/**
 * Input for get_visualization_capabilities tool
 */
export interface GetVisualizationCapabilitiesInput {
  pluginId: string;
}
