import { DataSourcePlugin } from '@grafana/data';
import CheatSheet from './CheatSheet';
import { ConfigEditor } from './configuration/ConfigEditor';
import { TempoDatasource } from './datasource';
import { TempoQueryField } from './QueryEditor/QueryField';

export const plugin = new DataSourcePlugin(TempoDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(CheatSheet)
  .setExploreQueryField(TempoQueryField);
