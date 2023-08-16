import { UrlQueryMap } from '@grafana/data';

export interface MigrationHandler<From extends BaseExploreURL | never, To> {
  /**
   * The parse function is used to parse the URL parameters into the state object.
   */
  parse: (params: UrlQueryMap) => To;
  /**
   *  the migrate function takes a state object from the previous schema version and returns a new state object
   */
  migrate?: From extends never ? never : (from: From) => To;
}

export interface BaseExploreURL {
  schemaVersion: number;
}
