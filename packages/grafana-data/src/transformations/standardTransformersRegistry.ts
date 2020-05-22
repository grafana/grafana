import React from 'react';
import { DataFrame, DataTransformerInfo } from '../types';
import { Registry, RegistryItem } from '../utils/Registry';

export interface TransformerUIProps<T> {
  /**
   * Transformer configuration, persisted on panel's model
   */
  options: T;
  /**
   * Pre-transform data rames
   */
  input: DataFrame[];
  onChange: (options: T) => void;
}

export interface TransformerRegistyItem<TOptions> extends RegistryItem {
  /**
   * Object describing transformer configuration
   */
  transformation: DataTransformerInfo<TOptions>;
  /**
   * React component used as UI for the transformer
   */
  editor: React.ComponentType<TransformerUIProps<TOptions>>;
}

/**
 * Registry of transformation options that can be driven by
 * stored configuration files.
 */
export const standardTransformersRegistry = new Registry<TransformerRegistyItem<any>>();
