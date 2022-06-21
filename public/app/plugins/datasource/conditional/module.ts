import { DataSourcePlugin } from '@grafana/data';

import { ConditionalDataSource } from './ConditionalDataSource';

const plugin = new DataSourcePlugin<any, any, any>(ConditionalDataSource);

export { plugin };
