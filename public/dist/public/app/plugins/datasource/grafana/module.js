import { DataSourcePlugin } from '@grafana/data';
import { QueryEditor } from './components/QueryEditor';
import { GrafanaDatasource } from './datasource';
export const plugin = new DataSourcePlugin(GrafanaDatasource).setQueryEditor(QueryEditor);
//# sourceMappingURL=module.js.map