import { DataSourcePlugin } from '@grafana/data';

import { ConditionalDataSource, ConditionalDataSourceQuery } from './ConditionalDataSource';

const plugin = new DataSourcePlugin<ConditionalDataSource, ConditionalDataSourceQuery, {}>(ConditionalDataSource);

export { plugin };
