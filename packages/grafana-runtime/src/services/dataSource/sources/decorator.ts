import { type DataSourceInstanceSettings } from '@grafana/data';

import { type BootDataSourceSettings, type DataSourceCacheSource, type DataSourceListSnapshot } from './types';

/**
 * Forwards every call to the source it wraps. Extend it to add behavior around a source, such as
 * monitoring, without changing the source itself.
 */
export class DataSourceCacheSourceDecorator implements DataSourceCacheSource {
  constructor(protected readonly inner: DataSourceCacheSource) {}

  get kind(): DataSourceCacheSource['kind'] {
    return this.inner.kind;
  }

  getInitialSnapshot(): DataSourceListSnapshot | undefined {
    return this.inner.getInitialSnapshot();
  }

  loadList(): Promise<DataSourceListSnapshot> {
    return this.inner.loadList();
  }

  refreshList(payload?: BootDataSourceSettings): Promise<DataSourceListSnapshot> {
    return this.inner.refreshList(payload);
  }

  loadSettings(uid: string): Promise<DataSourceInstanceSettings | undefined> {
    return this.inner.loadSettings(uid);
  }
}
