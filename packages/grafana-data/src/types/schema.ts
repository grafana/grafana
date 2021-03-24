export interface ModelSchemaInfo {
  /** Major, minor release numbers -- these may be independent from grafana versions */
  version: readonly number[];

  /**
   * YYYY/MM/DD that the schema was last changed
   */
  changed: string;
}
