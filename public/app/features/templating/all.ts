import './editor_ctrl';
import coreModule from 'app/core/core_module';

import templateSrv from './template_srv';
import { VariableSrv } from './variable_srv';
import { IntervalVariable } from './interval_variable';
import { QueryVariable } from './query_variable';
import { DatasourceVariable } from './datasource_variable';
import { CustomVariable } from './custom_variable';
import { ConstantVariable } from './constant_variable';
import { AdhocVariable } from './adhoc_variable';
import { TextBoxVariable } from './TextBoxVariable';
import { variableAdapters } from './adapters';
import { createQueryVariableAdapter } from './query/adapter';

coreModule.factory('templateSrv', () => templateSrv);

export {
  VariableSrv,
  IntervalVariable,
  QueryVariable,
  DatasourceVariable,
  CustomVariable,
  ConstantVariable,
  AdhocVariable,
  TextBoxVariable,
};

variableAdapters.set('query', createQueryVariableAdapter());
