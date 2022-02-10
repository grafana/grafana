import { DataSourcePlugin } from '@grafana/data';
import { ZipkinDatasource } from './datasource';
import { ZipkinQueryField } from './QueryField';
import { ConfigEditor } from './ConfigEditor';

export const plugin = new DataSourcePlugin(ZipkinDatasource)
  .setQueryEditor(ZipkinQueryField)
  .setConfigEditor(ConfigEditor);
