import { type DataSourceInstanceSettings } from '@grafana/data';

import { NoUserSessionError } from '../../user';

import { type DataSourceCacheSource, type DataSourceListSnapshot } from './types';

/**
 * Selected instead of the MT source when there is no user session, e.g. on the login page. The MT
 * APIs reject such requests, so this source sends none and rejects every load instead.
 */
export class NoSessionDataSource implements DataSourceCacheSource {
  readonly kind = 'noSession';

  getInitialSnapshot(): undefined {
    return undefined;
  }

  async loadList(): Promise<DataSourceListSnapshot> {
    throw new NoUserSessionError();
  }

  async refreshList(): Promise<DataSourceListSnapshot> {
    throw new NoUserSessionError();
  }

  async loadSettings(): Promise<DataSourceInstanceSettings | undefined> {
    throw new NoUserSessionError();
  }
}
