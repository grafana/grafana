import { type DataQueryRequest } from '@grafana/data';
import { type DataQuery } from '@grafana/schema';

import { DataSourceWithBackend } from './DataSourceWithBackend';

/**
 * @alpha Experimental: Plugins implementing MigrationHandler interface will automatically have their queries migrated.
 */
export interface MigrationHandler {
  hasBackendMigration: boolean;
  shouldMigrate(query: DataQuery): boolean;
}

export function isMigrationHandler(object: unknown): object is MigrationHandler {
  return object instanceof DataSourceWithBackend && 'hasBackendMigration' in object && 'shouldMigrate' in object;
}

/**
 * @alpha Experimental: Migrates a single query. Currently a no-op pending migration endpoint implementation.
 */
export async function migrateQuery<TQuery extends DataQuery>(
  datasource: MigrationHandler,
  query: TQuery
): Promise<TQuery> {
  return query;
}

/**
 * @alpha Experimental: Migrates all queries in a request. Currently a no-op pending migration endpoint implementation.
 */
export async function migrateRequest<TQuery extends DataQuery>(
  datasource: MigrationHandler,
  request: DataQueryRequest<TQuery>
): Promise<DataQueryRequest<TQuery>> {
  return request;
}
