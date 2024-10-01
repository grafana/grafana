import * as React from 'react';

import { DataFrame } from '../types/dataFrame';
import { DataTransformerInfo } from '../types/transformations';
import { Registry, RegistryItem } from '../utils/Registry';

export interface TransformerUIProps<T> {
  /**
   * Transformer configuration, persisted on panel's model
   */
  options: T;
  /**
   * Pre-transform data frames
   */
  input: DataFrame[];
  onChange: (options: T) => void;
}

export interface TransformerRegistryItem<TOptions> extends RegistryItem {
  /**
   * Object describing transformer configuration
   */
  transformation: DataTransformerInfo<TOptions>;

  /** Markdown with more detailed description and help */
  help?: string;

  /**
   * React component used as UI for the transformer
   */
  editor: React.ComponentType<TransformerUIProps<TOptions>>;

  /**
   * Set of categories associated with the transformer
   */
  categories?: Set<TransformerCategory>;
}

export enum TransformerCategory {
  Combine = 'combine',
  CalculateNewFields = 'calculateNewFields',
  CreateNewVisualization = 'createNewVisualization',
  Filter = 'filter',
  PerformSpatialOperations = 'performSpatialOperations',
  Reformat = 'reformat',
  ReorderAndRename = 'reorderAndRename',
}

/**
 * Registry of transformation options that can be driven by
 * stored configuration files.
 */
export const standardTransformersRegistry = new Registry<TransformerRegistryItem<any>>();
