import { DataSourcePlugin } from '@grafana/data';
import { config } from '@grafana/runtime';

import { ConfigEditor as ConfigEditorV1 } from './components/editor/config/ConfigEditor';
import { ConfigEditor as ConfigEditorV2 } from './components/editor/config-v2/ConfigEditor';
import { QueryEditor } from './components/editor/query/QueryEditor';
import { InfluxStartPage } from './components/editor/query/influxql/InfluxStartPage';
import InfluxDatasource from './datasource';

// ConfigEditorV2 is the new design for the InfluxDB configuration page
const configEditor = config.featureToggles.newInfluxDSConfigPageDesign ? ConfigEditorV2 : ConfigEditorV1;

export const plugin = new DataSourcePlugin(InfluxDatasource)
  .setConfigEditor(configEditor)
  .setQueryEditor(QueryEditor)
  .setQueryEditorHelp(InfluxStartPage);
