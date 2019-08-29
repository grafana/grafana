import React from 'react';
import { DataFrame, RegistryItem } from '@grafana/data';

export interface TransformerUIRegistyItem extends RegistryItem {
  component: React.ComponentType<any>;
}

export interface TransformerUIProps<T> {
  // Transformer configuration, persisted on panel's model
  options: T;
  // Pre-transformation data frame
  input: DataFrame[];
  onChange: (options: T) => void;
}
