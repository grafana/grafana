import { DataSourcePlugin } from '@grafana/data';

import { InputDatasource } from './InputDatasource';

import { InputQueryEditor } from './InputQueryEditor';
import { InputConfigEditor } from './InputConfigEditor';
import { InputOptions, InputQuery } from './types';

export const plugin = new DataSourcePlugin<InputDatasource, InputQuery, InputOptions>(InputDatasource)
  .setConfigEditor(InputConfigEditor)
  .setQueryEditor(InputQueryEditor);
