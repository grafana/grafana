import { DataSourcePlugin } from '@grafana/data/types';

import { MixedDatasource } from './MixedDataSource';

export const plugin = new DataSourcePlugin(MixedDatasource);
