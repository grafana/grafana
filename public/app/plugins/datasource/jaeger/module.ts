import { DataSourcePlugin } from '@grafana/data';

import CheatSheet from './CheatSheet';
import { QueryEditor } from './components/QueryEditor';
import { ConfigEditor } from './configuration/ConfigEditor';
import { JaegerDatasource } from './datasource';

export const plugin = new DataSourcePlugin(JaegerDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setQueryEditorHelp(CheatSheet);
