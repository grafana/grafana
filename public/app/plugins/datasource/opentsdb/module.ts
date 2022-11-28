import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './components/ConfigEditor';
import OpenTsDatasource from './datasource';
import { OpenTsQueryCtrl } from './query_ctrl';

export const plugin = new DataSourcePlugin(OpenTsDatasource)
  .setQueryCtrl(OpenTsQueryCtrl)
  .setConfigEditor(ConfigEditor);
