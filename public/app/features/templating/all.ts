import './editor_ctrl';
import coreModule from 'app/core/core_module';

import { TemplateSrv } from './template_srv';
import { VariableSrv } from './variable_srv';
import { IntervalVariable } from './interval_variable';
import { QueryVariable } from './query_variable';
import { DatasourceVariable } from './datasource_variable';
import { CustomVariable } from './custom_variable';
import { ConstantVariable } from './constant_variable';
import { AdhocVariable } from './adhoc_variable';

coreModule.service('templateSrv', TemplateSrv);

export {
  TemplateSrv,
  VariableSrv,
  IntervalVariable,
  QueryVariable,
  DatasourceVariable,
  CustomVariable,
  ConstantVariable,
  AdhocVariable,
};
