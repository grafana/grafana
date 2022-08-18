import { DataSourcePlugin } from '@grafana/data';

import ConfigEditor from './components/ConfigEditor';
import InfluxStartPage from './components/InfluxStartPage';
import { QueryEditor } from './components/QueryEditor';
import VariableQueryEditor from './components/VariableQueryEditor';
import InfluxDatasource from './datasource';

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setVariableQueryEditor(VariableQueryEditor)
  .setQueryEditorHelp(InfluxStartPage);
