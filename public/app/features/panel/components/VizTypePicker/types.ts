import { type DataTransformerConfig, type FieldConfigSource } from '@grafana/data';

export interface VizTypeChangeDetails {
  pluginId: string;
  options?: Record<string, unknown>;
  fieldConfig?: FieldConfigSource;
  /** Added after the panel's own transformations, whose output the suggestion was made for. */
  transformations?: DataTransformerConfig[];
  withModKey?: boolean;
  fromSuggestions?: boolean;
  suggestionMetadata?: {
    suggestionName: string;
    suggestionIndex: number;
  };
}
