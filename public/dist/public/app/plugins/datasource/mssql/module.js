import { DataSourcePlugin } from '@grafana/data';
import { SqlQueryEditor } from 'app/features/plugins/sql/components/QueryEditor';
import { CheatSheet } from './CheatSheet';
import { ConfigurationEditor } from './configuration/ConfigurationEditor';
import { MssqlDatasource } from './datasource';
export const plugin = new DataSourcePlugin(MssqlDatasource)
    .setQueryEditor(SqlQueryEditor)
    .setQueryEditorHelp(CheatSheet)
    .setConfigEditor(ConfigurationEditor);
//# sourceMappingURL=module.js.map