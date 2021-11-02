import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './components/ConfigEditor';
import { CloudWatchDatasource } from './datasource';
import { CloudWatchAnnotationsQueryCtrl } from './annotations_query_ctrl';
import { CloudWatchLogsQueryEditor } from './components/LogsQueryEditor';
import { PanelQueryEditor } from './components/PanelQueryEditor';
import LogsCheatSheet from './components/LogsCheatSheet';
import { LiveMeasurementsSupport } from 'app/features/live/measurements/measurementsSupport';
export var plugin = new DataSourcePlugin(CloudWatchDatasource)
    .setQueryEditorHelp(LogsCheatSheet)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(PanelQueryEditor)
    .setExploreMetricsQueryField(PanelQueryEditor)
    .setExploreLogsQueryField(CloudWatchLogsQueryEditor)
    .setAnnotationQueryCtrl(CloudWatchAnnotationsQueryCtrl)
    .setChannelSupport(new LiveMeasurementsSupport());
//# sourceMappingURL=module.js.map