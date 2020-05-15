import coreModule from 'app/core/core_module';
import templateSrv from './template_srv';
import { VariableSrv } from './variable_srv';

coreModule.factory('templateSrv', () => templateSrv);

export { VariableSrv };
