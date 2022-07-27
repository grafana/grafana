import { Field } from '@grafana/data';

export interface BaseDimensionConfig<T = any> {
  fixed: T;
  field?: string;
}

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

export enum ScaleDimensionMode {
  Linear = 'linear',
  Quadratic = 'quad',
}

/** This will map the field value% to a scaled value within the range */
export interface ScaleDimensionConfig extends BaseDimensionConfig<number> {
  min: number;
  max: number;
}

/** Places that use the value */
export interface ScaleDimensionOptions {
  min: number;
  max: number;
  step?: number;
  hideRange?: boolean; // false
}

export enum ScalarDimensionMode {
  Mod = 'mod',
  Clamped = 'clamped',
}
export interface ScalarDimensionConfig extends BaseDimensionConfig<number> {
  mode: ScalarDimensionMode;
  min: number;
  max: number;
}

export interface ScalarDimensionOptions {
  min: number;
  max: number;
}

export interface TextDimensionOptions {
  // anything?
}

export enum TextDimensionMode {
  Fixed = 'fixed',
  Field = 'field',
  Template = 'template',
}

export interface TextDimensionConfig extends BaseDimensionConfig<string> {
  mode: TextDimensionMode;
}

export const defaultTextConfig: TextDimensionConfig = Object.freeze({
  fixed: '',
  mode: TextDimensionMode.Field,
  field: '',
});

/** Use the color value from field configs */
export interface ColorDimensionConfig extends BaseDimensionConfig<string> {}

/** Places that use the value */
export interface ResourceDimensionOptions {
  resourceType: MediaType;
  folderName?: ResourceFolderName;
  placeholderText?: string;
  placeholderValue?: string;
  // If you want your icon to be driven by value of a field
  showSourceRadio?: boolean;
}

export enum ResourceDimensionMode {
  Fixed = 'fixed',
  Field = 'field',
  Mapping = 'mapping',
  // pattern? uses field in the pattern
}

/** Get the path to a resource (URL) */
export interface ResourceDimensionConfig extends BaseDimensionConfig<string> {
  mode: ResourceDimensionMode;
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
