import { DataSourcePlugin } from '@grafana/data';

import { InputConfigEditor } from './InputConfigEditor';
import { InputDatasource } from './InputDatasource';
import { InputQueryEditor } from './InputQueryEditor';
import { InputOptions, InputQuery } from './types';

export const plugin = new DataSourcePlugin<InputDatasource, InputQuery, InputOptions>(InputDatasource)
  .setConfigEditor(InputConfigEditor)
  .setQueryEditor(InputQueryEditor);
