import { DataSourcePlugin } from '@grafana/ui';

import { InputDatasource } from './InputDatasource';

import { InputQueryEditor } from './InputQueryEditor';
import { InputConfigEditor } from './InputConfigEditor';
import { InputSettings, InputQuery } from './types';

export const plugin = new DataSourcePlugin<InputSettings, InputQuery>(InputDatasource)
  .setConfigEditor(InputConfigEditor)
  .setQueryEditor(InputQueryEditor);
