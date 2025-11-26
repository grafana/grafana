import { DataSourcePlugin } from '@grafana/data';
import { DataSource } from './datasource';
import { ConfigEditor } from './components/ConfigEditor';
import { QueryEditor } from './components/QueryEditor';
import { MyQuery, MyDataSourceOptions } from './types';
import pluginJson from './plugin.json';
import { initPluginTranslations, t } from '@grafana/i18n';

await initPluginTranslations(pluginJson.id);

console.warn(t('grafana-test-datasource.config', 'my message'));

export const plugin = new DataSourcePlugin<DataSource, MyQuery, MyDataSourceOptions>(DataSource)
  .setConfigEditor(ConfigEditor)
  .setQueryEditor(QueryEditor);
