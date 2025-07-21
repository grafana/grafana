import { DataSourcePlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import {
  PrometheusDatasource,
  PromQueryEditorByApp,
  PromCheatSheet,
  loadResources as loadPrometheusResources,
} from '@grafana/prometheus';

import { ConfigEditor } from './configuration/ConfigEditorPackage';
import pluginJson from './plugin.json';

// don't load plugin translations in test environments
// we don't use them anyway, and top-level await won't work currently in jest
if (process.env.NODE_ENV !== 'test') {
  await initPluginTranslations(pluginJson.id, [loadPrometheusResources]);
}

export const plugin = new DataSourcePlugin(PrometheusDatasource)
  .setQueryEditor(PromQueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(PromCheatSheet);
