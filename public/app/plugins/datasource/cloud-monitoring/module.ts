import { DataSourcePlugin } from '@grafana/data';
import CloudMonitoringDatasource from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';

import CloudMonitoringCheatSheet from './components/CloudMonitoringCheatSheet';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import { CloudMonitoringQuery } from './types';

export const plugin = new DataSourcePlugin<CloudMonitoringDatasource, CloudMonitoringQuery>(CloudMonitoringDatasource)
  .setQueryEditorHelp(CloudMonitoringCheatSheet)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(CloudMonitoringVariableQueryEditor);
