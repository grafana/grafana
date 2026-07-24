import { DataSourcePlugin } from '@grafana/data';

import { MixedDatasource } from './MixedDataSource';

export const plugin = new DataSourcePlugin(MixedDatasource);
