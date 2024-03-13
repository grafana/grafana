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

const PrometheusDataSourceUsed = usePackage ? PrometheusDatasource : PrometheusDatasourcePackage;
const PromQueryEditorByAppUsed = usePackage ? PromQueryEditorByApp : PromQueryEditorByAppPackage;
const ConfigEditorUsed = usePackage ? ConfigEditor : ConfigEditorPackage;
const PromCheatSheetUsed = usePackage ? PromCheatSheet : PromCheatSheetPackage;

// @ts-ignore
export const plugin = new DataSourcePlugin(PrometheusDataSourceUsed)
  // @ts-ignore
  .setQueryEditor(PromQueryEditorByAppUsed)
  .setConfigEditor(ConfigEditorUsed)
  .setQueryEditorHelp(PromCheatSheetUsed);
