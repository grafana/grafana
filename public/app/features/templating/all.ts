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
import { variableAdapters } from '../variables/adapters';
import { createQueryVariableAdapter } from '../variables/query/adapter';
import { createCustomVariableAdapter } from '../variables/custom/adapter';
import { createTextBoxVariableAdapter } from '../variables/textbox/adapter';
import { createConstantVariableAdapter } from '../variables/constant/adapter';
import { createDataSourceVariableAdapter } from '../variables/datasource/adapter';
import { createAdHocVariableAdapter } from '../variables/adhoc/adapter';
import { createIntervalVariableAdapter } from '../variables/interval/adapter';

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
variableAdapters.set('custom', createCustomVariableAdapter());
variableAdapters.set('textbox', createTextBoxVariableAdapter());
variableAdapters.set('constant', createConstantVariableAdapter());
variableAdapters.set('datasource', createDataSourceVariableAdapter());
variableAdapters.set('adhoc', createAdHocVariableAdapter());
variableAdapters.set('interval', createIntervalVariableAdapter());
