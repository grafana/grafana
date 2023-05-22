import { Field } from '@grafana/data';
import { TextDimensionConfig, TextDimensionMode } from '@grafana/schema';

export interface DimensionSupplier<T = any> {
  /**
   * This means an explicit value was not configured
   */
  isAssumed?: boolean;

  /**
   * The field used for
   */
  field?: Field;

  /**
   * Explicit value -- if == null, then need a value for each index
   */
  fixed?: T;

  /**
   * A single value -- typically last
   */
  value: () => T;

  /**
   * Supplier for the dimension value
   */
  get: (index: number) => T;
}

/** Places that use the value */
export interface ScaleDimensionOptions {
  min: number;
  max: number;
  step?: number;
  hideRange?: boolean; // false
}

export interface ScalarDimensionOptions {
  min: number;
  max: number;
}

export interface TextDimensionOptions {
  // anything?
}

export const defaultTextConfig: TextDimensionConfig = Object.freeze({
  fixed: '',
  mode: TextDimensionMode.Field,
  field: '',
});

/** Places that use the value */
export interface ResourceDimensionOptions {
  resourceType: MediaType;
  folderName?: ResourceFolderName;
  placeholderText?: string;
  placeholderValue?: string;
  // If you want your icon to be driven by value of a field
  showSourceRadio?: boolean;
}

export enum ResourceFolderName {
  Icon = 'img/icons/unicons',
  IOT = 'img/icons/iot',
  Marker = 'img/icons/marker',
  BG = 'img/bg',
}

export enum MediaType {
  Icon = 'icon',
  Image = 'image',
}

export enum PickerTabType {
  Folder = 'folder',
  URL = 'url',
  Upload = 'upload',
}

export enum ResourcePickerSize {
  SMALL = 'small',
  NORMAL = 'normal',
}
