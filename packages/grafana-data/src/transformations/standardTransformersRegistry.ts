import type * as React from 'react';

import { type DataFrame } from '../types/dataFrame';
import { type DataTransformerInfo } from '../types/transformations';
import { Registry, type RegistryItem } from '../utils/Registry';

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

export interface TransformerRegistryItem<TOptions = any> extends RegistryItem {
  /**
   * Resolver for the transformer configuration. Returns a promise that resolves to the
   * DataTransformerInfo containing the operator function and metadata.
   * Use `Promise.resolve(info)` for eagerly-loaded transformers.
   */
  transformation: () => Promise<DataTransformerInfo<TOptions>>;

  /**
   * Default options for this transformer, used when rendering the editor.
   * Hoisted from DataTransformerInfo so it's available synchronously without
   * resolving the transformation promise.
   */
  defaultOptions?: Partial<TOptions>;

  /**
   * Checks whether this transformer is applicable to the given data.
   * Hoisted from DataTransformerInfo so the picker can check applicability
   * without resolving the async transformation.
   */
  isApplicable?: (data: DataFrame[]) => number;

  /**
   * Description shown when the transformer is not applicable.
   */
  isApplicableDescription?: string | ((data: DataFrame[]) => string);

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

  /**
   * Set of tags associated with the transformer for improved transformation search
   */
  tags?: Set<string>;

  /**
   * Image representing the transformer, for dark themes
   */
  imageDark: string;

  /**
   * Image representing the transformer, for light themes
   */
  imageLight: string;
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
export const standardTransformersRegistry = new Registry<TransformerRegistryItem>();
