import { DataSourcePlugin } from '@grafana/data';
import { JaegerDatasource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
import { ConfigEditor } from './components/ConfigEditor';
export var plugin = new DataSourcePlugin(JaegerDatasource).setConfigEditor(ConfigEditor).setQueryEditor(QueryEditor);
//# sourceMappingURL=module.js.map