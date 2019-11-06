import { DataSourcePlugin } from '@grafana/data';
import Datasource from './datasource';

import LokiCheatSheet from './components/LokiCheatSheet';
import LokiQueryField from './components/LokiQueryField';
import LokiQueryEditor from './components/LokiQueryEditor';
import { LokiAnnotationsQueryCtrl } from './LokiAnnotationsQueryCtrl';
import { ConfigEditor } from './configuration/ConfigEditor';

export const plugin = new DataSourcePlugin(Datasource)
  .setQueryEditor(LokiQueryEditor)
  .setConfigEditor(ConfigEditor)
  .setExploreQueryField(LokiQueryField)
  .setExploreStartPage(LokiCheatSheet)
  .setAnnotationQueryCtrl(LokiAnnotationsQueryCtrl);
