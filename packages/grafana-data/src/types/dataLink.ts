import { ScopedVars } from './ScopedVars';
import { DataQuery } from './datasource';

/**
 * Callback info for DataLink click events
 */
export interface DataLinkClickEvent<T = any> {
  origin: T;
  scopedVars?: ScopedVars;
  e?: any; // mouse|react event
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
  // datas ource that we want to show to the user. Usually this results in a link to explore but can also lead to
  // more custom onClick behaviour if needed.
  // @internal and subject to change in future releases
  internal?: {
    query: T;
    datasourceUid: string;
  };
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
  onClick?: (e: any) => void;
}

/**
 * Provides a way to produce links on demand
 *
 * TODO: ScopedVars in in GrafanaUI package!
 */
export interface LinkModelSupplier<T extends object> {
  getLinks(scopedVars?: any): Array<LinkModel<T>>;
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
