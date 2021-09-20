/**
 * Attached to query results (not persisted)
 *
 * @public
 */
export enum DataTopic {
  Annotations = 'annotations',
}

/**
 * In 8.2, this will become an interface
 *
 * @public
 */
export type DatasourceRef = string;

/**
 * These are the common properties available to all queries in all datasources
 * Specific implementations will *extend* this interface adding the required properties
 * for the given context
 *
 * @public
 */
export interface DataQuery {
  /**
   * A - Z
   */
  refId: string;

  /**
   * true if query is disabled (ie should not be returned to the dashboard)
   */
  hide?: boolean;

  /**
   * Unique, guid like, string used in explore mode
   */
  key?: string;

  /**
   * Specify the query flavor
   */
  queryType?: string;

  /**
   * The datasource ref of the datasource. This can be undefined to not break older code.
   */
  datasource?: DatasourceRef;

  /**
   * The id of the datasource. This can be undefined to not break older code.
   */
  datasourceId?: number;
}
