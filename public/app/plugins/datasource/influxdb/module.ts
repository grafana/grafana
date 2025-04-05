import { DataSourcePlugin } from '@grafana/data';

// import ConfigEditor from './components/editor/config/ConfigEditor';
import { ConfigEditor } from './components/editor/config-v2/ConfigEditor';
import { QueryEditor } from './components/editor/query/QueryEditor';
import { InfluxStartPage } from './components/editor/query/influxql/InfluxStartPage';
import InfluxDatasource from './datasource';

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor)
  .setQueryEditorHelp(InfluxStartPage);
