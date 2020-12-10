import coreModule from 'app/core/core_module';
import { getTemplateSrv } from './template_srv';

coreModule.factory('templateSrv', () => getTemplateSrv());
