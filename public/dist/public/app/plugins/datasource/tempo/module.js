import { DataSourcePlugin } from '@grafana/data';
import CheatSheet from './CheatSheet';
import { ConfigEditor } from './configuration/ConfigEditor';
import { TempoDatasource } from './datasource';
import { TempoQueryField } from './QueryField';
export var plugin = new DataSourcePlugin(TempoDatasource)
    .setConfigEditor(ConfigEditor)
    .setQueryEditorHelp(CheatSheet)
    .setExploreQueryField(TempoQueryField);
//# sourceMappingURL=module.js.map