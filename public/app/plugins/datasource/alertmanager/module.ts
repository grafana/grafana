import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './ConfigEditor';
import { AlertManagerDatasource } from './DataSource';

// This is not actually a data source but since 7.1,
// it is required to specify query types. Which we don't have.
// @ts-ignore
export const plugin = new DataSourcePlugin(AlertManagerDatasource).setConfigEditor(ConfigEditor);
