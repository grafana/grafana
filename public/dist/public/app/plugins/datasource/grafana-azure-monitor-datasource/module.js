import { DataSourcePlugin } from '@grafana/data';
import Datasource from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import AzureMonitorQueryEditor from './components/QueryEditor';
export var plugin = new DataSourcePlugin(Datasource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(AzureMonitorQueryEditor);
//# sourceMappingURL=module.js.map