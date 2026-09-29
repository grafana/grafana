import { type DataSourceInstanceSettings } from '@grafana/data';

import { type InstanceSettingsCache } from './instanceSettingsCache';

export interface DataSourceSettingsCacheProvider extends InstanceSettingsCache {
  readonly source: 'config' | 'api';
  waitUntilReady(): Promise<void>;
  refreshList(): Promise<void>;
  refreshSettings(uid: string, type: string): Promise<DataSourceInstanceSettings | undefined>;
  sync(settings: Record<string, DataSourceInstanceSettings>, defaultName: string): void;
}
