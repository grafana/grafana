import { TracedError } from '../../utils/TracedError';
import { NoUserSessionError } from '../user';

/**
 * The data source list failed to load. Every async data source API rejects with this error until
 * a later fill succeeds; the legacy `DataSourceSrv` fallback does not apply.
 *
 * `isHandled` marks the failure as already logged, so `getCachedPromise` does not log it again.
 */
export class DataSourceListFetchError extends TracedError {
  readonly isHandled = true;

  constructor(cause: unknown) {
    super('DataSource: failed to load the data source list', cause);
    this.name = 'DataSourceListFetchError';
  }
}

/**
 * The settings for one data source failed to load (anything but "not found"). Not cached, so the
 * next lookup retries; the legacy `DataSourceSrv` fallback does not apply.
 *
 * `isHandled` marks the failure as already logged, so `getCachedPromise` does not log it again.
 */
export class DataSourceSettingsFetchError extends TracedError {
  readonly isHandled = true;

  constructor(
    readonly uid: string,
    cause: unknown
  ) {
    super(`DataSource: failed to load the settings for ${uid}`, cause);
    this.name = 'DataSourceSettingsFetchError';
  }
}

/**
 * The data source plugin failed to import or construct. The failure is already logged and shown
 * to the user, and the legacy `DataSourceSrv` fallback does not apply: it would import the plugin
 * a second time. Not cached, so the next lookup retries.
 *
 * Keeps the cause's message, because callers show it as the reason the plugin did not load.
 * `isHandled` marks the failure as already logged, so `getCachedPromise` does not log it again.
 *
 * @internal
 */
export class DataSourcePluginImportError extends TracedError {
  readonly isHandled = true;

  constructor(
    readonly uid: string,
    cause: unknown
  ) {
    super(cause instanceof Error ? cause.message : `Failed to load the plugin for data source ${uid}`, cause);
    this.name = 'DataSourcePluginImportError';
  }
}

export function isDataSourceLoadError(error: unknown): boolean {
  return (
    error instanceof DataSourceListFetchError ||
    error instanceof DataSourceSettingsFetchError ||
    error instanceof DataSourcePluginImportError ||
    error instanceof NoUserSessionError
  );
}
