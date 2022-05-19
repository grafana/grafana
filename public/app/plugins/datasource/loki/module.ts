import { DataSourcePlugin } from '@grafana/data';

import { LokiAnnotationsQueryCtrl } from './LokiAnnotationsQueryCtrl';
import LokiCheatSheet from './components/LokiCheatSheet';
import LokiQueryEditorByApp from './components/LokiQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { LokiDatasource } from './datasource';

export const plugin = new DataSourcePlugin(LokiDatasource)
  .setQueryEditor(LokiQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(LokiCheatSheet)
  .setAnnotationQueryCtrl(LokiAnnotationsQueryCtrl);
