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
import { PrometheusDatasource } from './datasource';

const usePackage = config.featureToggles.usePrometheusFrontendPackage;
const DataSource = usePackage ? PrometheusDatasource : PrometheusDatasourcePackage;
const QueryEditorByApp = usePackage ? PromQueryEditorByApp : PromQueryEditorByAppPackage;
const CheatSheet = usePackage ? PromCheatSheet : PromCheatSheetPackage;

// @ts-ignore
export const plugin = new DataSourcePlugin(DataSource)
  // @ts-ignore
  .setQueryEditor(QueryEditorByApp)
  .setConfigEditor(ConfigEditor)
  .setQueryEditorHelp(CheatSheet);
