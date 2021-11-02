import { DataSourcePlugin } from '@grafana/data';
import { GrafanaDatasource } from './datasource';
import { QueryEditor } from './components/QueryEditor';
export var plugin = new DataSourcePlugin(GrafanaDatasource).setQueryEditor(QueryEditor);
//# sourceMappingURL=module.js.map