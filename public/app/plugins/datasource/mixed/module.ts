import { MixedDatasource } from './MixedDatasource';
import { DataSourcePlugin } from '@grafana/ui';

export const plugin = new DataSourcePlugin(MixedDatasource);
