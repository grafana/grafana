import React from 'react';
import { DataFrame, RegistryItem, DataTransformerInfo } from '@grafana/data';

export interface TransformerUIRegistyItem<TOptions> extends RegistryItem {
  component: React.ComponentType<TransformerUIProps<TOptions>>;
  transformer: DataTransformerInfo<TOptions>;
}

export interface TransformerUIProps<T> {
  // Transformer configuration, persisted on panel's model
  options: T;
  // Pre-transformation data frame
  input: DataFrame[];
  onChange: (options: T) => void;
}
