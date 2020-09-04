import { DataQuery } from './datasource';
import { TimeRange, RawTimeRange } from './time';
import { DataFrame } from './dataFrame';

export interface StandardAnnotationQuery<TQuery = {}> {
  datasource: string;
  enable: boolean;
  name: string;

  // Standard datasource query
  query?: TQuery;

  // Convert a dataframe to an annotation
  mappings?: AnnotationEventMappings;
}

/**
 * Options passed to the datasource.annotationQuery method. See docs/plugins/developing/datasource.md
 *
 * @deprecated -- use {@link AnnotationProcessor}
 */
export interface AnnotationQueryRequest<MoreOptions = {}> {
  range: TimeRange;
  rangeRaw: RawTimeRange;
  // Should be DataModel but cannot import that here from the main app. Needs to be moved to package first.
  dashboard: any;
  annotation: {
    datasource: string;
    enable: boolean;
    name: string;
  } & MoreOptions;
}

export interface AnnotationEvent {
  id?: string;
  annotation?: any;
  dashboardId?: number;
  panelId?: number;
  userId?: number;
  login?: string;
  email?: string;
  avatarUrl?: string;
  time?: number;
  timeEnd?: number;
  isRegion?: boolean;
  title?: string;
  text?: string;
  type?: string;
  tags?: string[];

  // Currently used to merge annotations from alerts and dashboard
  source?: any; // source.type === 'dashboard'
}

export enum AnnotationEventFieldMapValue {
  Field = 'field', // Default -- find the value with a matching key
  Text = 'text', // Write a constant string into the value
  Skip = 'skip', // Do not include the field
}

export interface AnnotationEventFieldMapping {
  source?: AnnotationEventFieldMapValue; // defautls to 'field'
  value?: string;
  regex?: string;
}

export type AnnotationEventMappings = Record<keyof AnnotationEvent, AnnotationEventFieldMapping>;

/**
 * Since Grafana 7.2
 *
 * This offers a generic approach to annotation processing
 */
export interface AnnotationProcessor<TQuery = DataQuery, TAnno = StandardAnnotationQuery<TQuery>> {
  /**
   * This hook lets you manipulate any existing stored values before running them though the processor.
   * This is particularly helpful when dealing with migrating old formats.  ie query as a string vs object
   */
  prepareAnnotation?(json: any): TAnno;

  /**
   * Convert the stored JSON model to a standard datasource query object.
   * This query will be executed in the datasource and the results converted into events.
   * Returning an undefined result will quietly skip query execution
   */
  prepareQuery?(anno: TAnno): TQuery | undefined;

  /**
   * When the standard frame > event processing is insufficient, this allows explicit control of the mappings
   */
  processEvents?(anno: TAnno, data: DataFrame): AnnotationEvent[] | undefined;
}
