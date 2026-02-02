import { DataTransformerConfig, TransformerRegistryItem } from '@grafana/data';

export type Transformation = {
  registryItem: TransformerRegistryItem | undefined;
  transformId: string;
  transformConfig: DataTransformerConfig;
};
