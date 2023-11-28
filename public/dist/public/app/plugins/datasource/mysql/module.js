import { DataSourcePlugin } from '@grafana/data';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { CheatSheet } from './CheatSheet';
import { MySqlDatasource } from './MySqlDatasource';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
export const plugin = new DataSourcePlugin(MySqlDatasource)
    .setQueryEditor(SqlQueryEditor)
    .setQueryEditorHelp(CheatSheet)
    .setConfigEditor(ConfigurationEditor);
//# sourceMappingURL=module.js.map