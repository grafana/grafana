import { DataSourcePlugin } from '@grafana/data';
import { CheatSheet } from './CheatSheet';
import { PostgresQueryEditor } from './PostgresQueryEditor';
import { PostgresConfigEditor } from './configuration/ConfigurationEditor';
import { PostgresDatasource } from './datasource';
export const plugin = new DataSourcePlugin(PostgresDatasource)
    .setQueryEditor(PostgresQueryEditor)
    .setQueryEditorHelp(CheatSheet)
    .setConfigEditor(PostgresConfigEditor);
//# sourceMappingURL=module.js.map