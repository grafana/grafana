import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { PyroscopeDataSource } from './datasource';
export const plugin = new DataSourcePlugin(PyroscopeDataSource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(QueryEditor);
//# sourceMappingURL=module.js.map