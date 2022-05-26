import { DataSourcePlugin } from '@grafana/data';

import CloudMonitoringCheatSheet from './components/CloudMonitoringCheatSheet';
import { ConfigEditor } from './components/ConfigEditor/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { CloudMonitoringVariableQueryEditor } from './components/VariableQueryEditor';
import CloudMonitoringDatasource from './datasource';
import { CloudMonitoringQuery } from './types';

export const plugin = new DataSourcePlugin<CloudMonitoringDatasource, CloudMonitoringQuery>(CloudMonitoringDatasource)
  .setQueryEditorHelp(CloudMonitoringCheatSheet)
  .setQueryEditor(QueryEditor)
  .setConfigEditor(ConfigEditor)
  .setVariableQueryEditor(CloudMonitoringVariableQueryEditor);
