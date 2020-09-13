import { DataSourcePlugin } from '@grafana/data';
import { JaegerDatasource } from './datasource';
import { JaegerQueryField } from './QueryField';
import { ConfigEditor } from './ConfigEditor';

export const plugin = new DataSourcePlugin(JaegerDatasource)
  .setConfigEditor(ConfigEditor)
  .setExploreQueryField(JaegerQueryField);
