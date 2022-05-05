import { DataSourcePlugin } from '@grafana/data';

import CheatSheet from './CheatSheet';
import { TempoQueryField } from './QueryEditor/QueryField';
import { ConfigEditor } from './configuration/ConfigEditor';
import { TempoDatasource } from './datasource';

export const plugin = new DataSourcePlugin(TempoDatasource)
  .setQueryEditor(TempoQueryField)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(CheatSheet);
