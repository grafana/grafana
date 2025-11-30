import { DataTransformerConfig } from '@grafana/data';

export interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  refId?: string;
  id: string;
}
