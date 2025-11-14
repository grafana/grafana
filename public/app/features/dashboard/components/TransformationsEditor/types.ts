import { DataTransformerConfig } from '@grafana/data';

export interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  id: string;
}
