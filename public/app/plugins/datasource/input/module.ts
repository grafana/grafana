import { DataSourcePlugin } from '@grafana/ui';

import { InputDatasource } from './InputDatasource';

import { InputQueryEditor } from './InputQueryEditor';
import { InputConfigEditor } from './InputConfigEditor';

export const plugin = new DataSourcePlugin(InputDatasource)
  .setConfigEditor(InputConfigEditor)
  .setQueryEditor(InputQueryEditor);
