import { DataSourcePlugin } from '@grafana/data';
import Datasource from './datasource';
import LokiCheatSheet from './components/LokiCheatSheet';
import LokiExploreQueryEditor from './components/LokiExploreQueryEditor';
import LokiQueryEditorByApp from './components/LokiQueryEditorByApp';
import { LokiAnnotationsQueryCtrl } from './LokiAnnotationsQueryCtrl';
import { ConfigEditor } from './configuration/ConfigEditor';
export var plugin = new DataSourcePlugin(Datasource)
    .setQueryEditor(LokiQueryEditorByApp)
    .setConfigEditor(ConfigEditor)
    .setExploreQueryField(LokiExploreQueryEditor)
    .setQueryEditorHelp(LokiCheatSheet)
    .setAnnotationQueryCtrl(LokiAnnotationsQueryCtrl);
//# sourceMappingURL=module.js.map