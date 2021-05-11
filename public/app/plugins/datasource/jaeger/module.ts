import { DataSourcePlugin } from '@grafana/data';
import { JaegerDatasource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ConfigEditor } from './components/ConfigEditor';

export const plugin = new DataSourcePlugin(JaegerDatasource).setConfigEditor(ConfigEditor).setQueryEditor(QueryEditor);
