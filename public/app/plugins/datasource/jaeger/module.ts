import { DataSourcePlugin } from '@grafana/data';

import CheatSheet from './CheatSheet';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { JaegerDatasource } from './datasource';

export const plugin = new DataSourcePlugin(JaegerDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setQueryEditorHelp(CheatSheet);
