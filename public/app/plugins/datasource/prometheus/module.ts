import { DataSourcePlugin } from '@grafana/data';
import {
  PrometheusDatasource as PrometheusDatasourcePackage,
  PromQueryEditorByApp as PromQueryEditorByAppPackage,
  PromCheatSheet as PromCheatSheetPackage,
} from '@grafana/prometheus';
import { config } from '@grafana/runtime';

import PromCheatSheet from './components/PromCheatSheet';
import PromQueryEditorByApp from './components/PromQueryEditorByApp';
import { ConfigEditor } from './configuration/ConfigEditor';
import { ConfigEditor as ConfigEditorPackage } from './configuration/ConfigEditorPackage';
import { PrometheusDatasource } from './datasource';

const usePackage = config.featureToggles.usePrometheusFrontendPackage;

const PrometheusDataSourceUsed = usePackage ? PrometheusDatasourcePackage : PrometheusDatasource;
const PromQueryEditorByAppUsed = usePackage ? PromQueryEditorByAppPackage : PromQueryEditorByApp;
const ConfigEditorUsed = usePackage ? ConfigEditorPackage : ConfigEditor;
const PromCheatSheetUsed = usePackage ? PromCheatSheetPackage : PromCheatSheet;

// @ts-ignore These type errors will be removed when we fully migrate to the @grafana/prometheus package
export const plugin = new DataSourcePlugin(PrometheusDataSourceUsed)
  // @ts-ignore These type errors will be removed when we fully migrate to the @grafana/prometheus package
  .setQueryEditor(PromQueryEditorByAppUsed)
  .setConfigEditor(ConfigEditorUsed)
  .setQueryEditorHelp(PromCheatSheetUsed);
