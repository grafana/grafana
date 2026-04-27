import type { DataTransformerConfig } from '@grafana/data/types';

export interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  id: string;
}
