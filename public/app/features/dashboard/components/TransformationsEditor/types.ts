import { DataTransformerConfig, TransformerRegistryItem } from '@grafana/data';

export interface TransformationsEditorTransformation {
  transformation: DataTransformerConfig;
  id: string;
}

export type TransformationCardTransform =
  | TransformerRegistryItem
  | {
      id: string;
      name: string;
      description: string;
    };
