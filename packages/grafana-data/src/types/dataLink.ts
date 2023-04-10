import { ExplorePanelsState } from './explore';
import { InterpolateFunction } from './panel';
import { DataQuery } from './query';
import { TimeRange } from './time';

/**
 * Callback info for DataLink click events
 */
export interface DataLinkClickEvent<T = any> {
  origin: T;
  replaceVariables: InterpolateFunction | undefined;
  e?: any; // mouse|react event
}

/**
 * Data Links can be created by data source plugins or correlations.
 * Origin is set in DataLink object and indicates where the link was created.
 */
export enum DataLinkConfigOrigin {
  Datasource = 'Datasource',
  Correlations = 'Correlations',
}

/**
 * Link configuration. The values may contain variables that need to be
 * processed before showing the link to user.
 *
 * TODO: <T extends DataQuery> is not strictly true for internal links as we do not need refId for example but all
 *  data source defined queries extend this so this is more for documentation.
 */
export interface DataLink<T extends DataQuery = any> {
  title: string;
  targetBlank?: boolean;

  // 3: The URL if others did not set it first
  url: string;

  // 2: If exists, use this to construct the URL
  // Not saved in JSON/DTO
  onBuildUrl?: (event: DataLinkClickEvent) => string;

  // 1: If exists, handle click directly
  // Not saved in JSON/DTO
  onClick?: (event: DataLinkClickEvent) => void;

  // If dataLink represents internal link this has to be filled. Internal link is defined as a query in a particular
  // data source that we want to show to the user. Usually this results in a link to explore but can also lead to
  // more custom onClick behaviour if needed.
  // @internal and subject to change in future releases
  internal?: InternalDataLink<T>;

  origin?: DataLinkConfigOrigin;
}

/** @internal
 *
 * We provide tooltips with information about these to guide the user, please
 * check for validity when adding more transformation types.
 */
export enum SupportedTransformationType {
  Regex = 'regex',
  Logfmt = 'logfmt',
}

/** @internal */
export interface DataLinkTransformationConfig {
  type: SupportedTransformationType;
  field?: string;
  expression?: string;
  mapValue?: string;
}

/** @internal */
export interface InternalDataLink<T extends DataQuery = any> {
  query: T;
  datasourceUid: string;
  datasourceName: string; // used as a title if `DataLink.title` is empty
  panelsState?: ExplorePanelsState;
  transformations?: DataLinkTransformationConfig[];
  range?: TimeRange;
}

export type LinkTarget = '_blank' | '_self' | undefined;

/**
 * Processed Link Model. The values are ready to use
 */
export interface LinkModel<T = any> {
  href: string;
  title: string;
  target: LinkTarget;
  origin: T;

  // When a click callback exists, this is passed the raw mouse|react event
  onClick?: (e: any, origin?: any) => void;
}

/**
 * Provides a way to produce links on demand
 *
 * TODO: ScopedVars in in GrafanaUI package!
 */
export interface LinkModelSupplier<T extends object> {
  getLinks(replaceVariables?: InterpolateFunction): Array<LinkModel<T>>;
}

export enum VariableOrigin {
  Series = 'series',
  Field = 'field',
  Fields = 'fields',
  Value = 'value',
  BuiltIn = 'built-in',
  Template = 'template',
}

export interface VariableSuggestion {
  value: string;
  label: string;
  documentation?: string;
  origin: VariableOrigin;
}

export enum VariableSuggestionsScope {
  Values = 'values',
}
