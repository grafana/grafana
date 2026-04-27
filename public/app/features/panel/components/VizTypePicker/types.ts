import type { FieldConfigSource } from '@grafana/data/types';

export interface VizTypeChangeDetails {
  pluginId: string;
  options?: Record<string, unknown>;
  fieldConfig?: FieldConfigSource;
  withModKey?: boolean;
  fromSuggestions?: boolean;
  suggestionMetadata?: {
    suggestionName: string;
    suggestionIndex: number;
  };
}
