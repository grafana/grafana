import { Registry, RegistryItem } from '../utils';
import React from 'react';
import { DataFrame, DataTransformerInfo } from '../types';

export interface TransformerUIProps<T> {
  // Transformer configuration, persisted on panel's model
  options: T;
  // Pre-transformation data frame
  input: DataFrame[];
  onChange: (options: T) => void;
}

export interface TransformerRegistyItem<TOptions> extends RegistryItem {
  component: React.ComponentType<TransformerUIProps<TOptions>>;
  transformation: DataTransformerInfo<TOptions>;
}

/**
 * Registry of transformation options that can be driven by
 * stored configuration files.
 */
export const standardTransformersRegistry = new Registry<TransformerRegistyItem<any>>();
