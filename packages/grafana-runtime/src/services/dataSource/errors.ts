import { TracedError } from '../../utils/TracedError';

/**
 * The data source list failed to load. Every async data source API rejects with this error until
 * a later fill succeeds; the legacy `DataSourceSrv` fallback does not apply.
 *
 * `isHandled` marks the failure as already logged, so `getCachedPromise` does not log it again.
 */
export class DataSourceCacheFillError extends TracedError {
  readonly isHandled = true;

  constructor(cause: unknown) {
    super('DataSource: failed to load the data source list', cause);
    this.name = 'DataSourceCacheFillError';
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

export function isDataSourceLoadError(error: unknown): boolean {
  return error instanceof DataSourceCacheFillError || error instanceof DataSourceSettingsFetchError;
}
