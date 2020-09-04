import { DataQueryError, DataQuery } from './datasource';
import { LoadingState } from './data';
import { DataFrame } from 'apache-arrow';
import { TimeRange, RawTimeRange } from './time';
import { CoreApp } from './app';
import { Observable } from 'rxjs';

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
 */
export interface AnnotationQueryRequest<TAnno = StandardAnnotationQuery> {
  range: TimeRange;
  rangeRaw: RawTimeRange;
  interval: string;
  intervalMs: number;
  maxDataPoints?: number;
  app: CoreApp | string;

  // Should be DataModel but cannot import that here from the main app. Needs to be moved to package first.
  dashboard: any;

  // The annotation query and common properties.  This is the object stored in the JSON model
  annotation: TAnno;
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
   * Convert the stored JSON model and environment to a standard datasource query object.
   * This query will be executed in the datasource and the results converted into events.
   * Returning an undefined result will quietly skip query execution
   */
  prepareQuery?(req: AnnotationQueryRequest<TAnno>): TQuery | undefined;

  /**
   * When the standard frame > event processing is insufficient, this allows explicit control of the mappings
   */
  processEvents?(req: AnnotationQueryRequest<TAnno>, data: DataFrame): AnnotationEvent[] | undefined;

  /**
   * In the rare case where standard execution is not possible (perhaps migrations),
   * implementing this function will entirely replace the standard execution lifecycle.
   *
   * When you return `undefined` the standard path will execute as normal
   */
  executeQuery?(req: AnnotationQueryRequest<any>): Observable<AnnotationQueryResponse> | undefined;
}

export interface AnnotationQueryResponse {
  /**
   * Optionally return the original data frames
   */
  data?: DataFrame; // Multiple frames will always be joined first

  /**
   * The processed annotation events
   */
  events?: AnnotationEvent[];

  /**
   * Optionally include error info along with the response data
   */
  error?: DataQueryError;

  /**
   * Use this to control which state the response should have
   * Defaults to LoadingState.Done if state is not defined
   */
  state?: LoadingState;
}
