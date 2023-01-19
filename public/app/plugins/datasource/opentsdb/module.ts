import { DataSourcePlugin } from '@grafana/data';

import { ConfigEditor } from './components/ConfigEditor';
import { OpenTsdbQueryEditor } from './components/OpenTsdbQueryEditor';
import OpenTsDatasource from './datasource';

export const plugin = new DataSourcePlugin(OpenTsDatasource)
  .setQueryEditor(OpenTsdbQueryEditor)
  .setConfigEditor(ConfigEditor);
