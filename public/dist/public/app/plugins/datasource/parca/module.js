import { DataSourcePlugin } from '@grafana/data';
import { ConfigEditor } from './ConfigEditor';
import { QueryEditor } from './QueryEditor/QueryEditor';
import { ParcaDataSource } from './datasource';
export const plugin = new DataSourcePlugin(ParcaDataSource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditor(QueryEditor);
//# sourceMappingURL=module.js.map