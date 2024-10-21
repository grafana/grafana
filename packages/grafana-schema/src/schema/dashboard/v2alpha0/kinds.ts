import {
  AnnotationPanelFilter,
  DashboardLink,
  DataSourceRef,
  DataTransformerConfig,
  FieldConfigSource,
} from '../../../index.gen';

import { Kind, Reference } from './common';

export interface VizConfigSpec {
  pluginVersion: string;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

// Eventually this will become a plugin-specific kind, TimeSeriesConfigKind, BarChartConfigKind
// Since we don't have those kinds exposed from plugins anywhere ATM lets keep the interface open enough to allow union in the future
export type VizConfigKind = Kind<string, VizConfigSpec>;

interface AnnotationQuerySpec {
  datasource: DataSourceRef;
  query: DataQueryKind;

  // TODO: Should be figured out based on datasource (Grafana ds)
  // builtIn?: number;
  // Below are currently existing options for annotation queries
  enable: boolean;
  filter: AnnotationPanelFilter;
  hide: boolean;
  iconColor: string;
  name: string;
}

//  Represent Grafana dashboard annotations
export type AnnotationQueryKind = Kind<'AnnotationQuery', AnnotationQuerySpec>;

export interface QueryOptionsSpec {
  timeFrom?: string;
  maxDataPoints?: number;
  timeShift?: string;
  queryCachingTTL?: number;
  interval?: string;
  cacheTimeout?: string;
}

/**
 * Represents an idividial query for a given data source type.
 * The kind is the plugin id.
 *
 * For example:
 * {
 *  kind: 'prometheus', // kind is plugin id!
 *  spec: {
 *   query: 'up',
 *   ...
 *  }
 */
type DataQueryKind = Kind<string, unknown>;

// Represents an idividual query for a given panel. Used within a QueryGroupKind.
interface PanelQuerySpec {
  query: DataQueryKind;
  datasource: DataSourceRef;

  refId: string;
  hidden: boolean;
}

type PanelQueryKind = Kind<'PanelQuery', PanelQuerySpec>;

/**
 * Represents a transformation, used within a QueryGroupKind
 * For example:
 * {
 *  kind: 'limitTransformation',
 *  spec: {
 
 *   ...
 *  }
 */
type TransformationKind = Kind<string, DataTransformerConfig>;

// Represents a group of queries with transformations and query group options
export interface QueryGroupSpec {
  queries: PanelQueryKind[];
  transformations: TransformationKind[];
  queryOptions: QueryOptionsSpec;
}
export type QueryGroupKind = Kind<'QueryGroup', QueryGroupSpec>;

// TODO: Provide precise specs for each individual variable types
export interface QueryVariableSpec {}
export type QueryVariableKind = Kind<'QueryVariable', QueryVariableSpec>;

export interface TextVariableSpec {}
export type TextVariableKind = Kind<'TextVariable', TextVariableSpec>;

// Encapsulates time settings for a dashboard
export interface TimeSettingsSpec {
  timezone: string;
  from: string;
  to: string;
  autoRefresh: string; //v1: refresh
  autoRefreshIntervals: string[]; // v1: timepicker.refresh_intervals
  quickRanges: string[]; // v1: timepicker.time_options , not exposed in the UI
  hideTimepicker: boolean; // v1: timepicker.hidden
  weekStart: string;
  fiscalYearStartMonth: number;
  nowDelay?: string; // v1: timepicker.nowDelay
}

//  Represents an individual grid item within a GridLayout
interface GridLayoutItemSpec {
  x: number;
  y: number;
  width: number;
  height: number;
  element: Reference; // reference to a PanelKind from dashboard.spec.elements Expressed as JSON Schema reference
}
export type GridLayoutItemKind = Kind<'GridLayoutItem', GridLayoutItemSpec>;

// Represents a grid layout within a dashboard
export interface GridLayoutSpec {
  items: GridLayoutItemKind[];
}
export type GridLayoutKind = Kind<'GridLayout', GridLayoutSpec>;

// Represents a panel within a dashboard, including viz plugin configuration
// and data queries with transformations & query options.
interface PanelSpec {
  uid: string;
  title: string;
  description: string;
  links: DashboardLink[];
  data: QueryGroupKind;
  vizConfig: VizConfigKind;
}

export type PanelKind = Kind<'Panel', PanelSpec>;
