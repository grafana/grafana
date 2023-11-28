import { TemplateSrv } from '../../app/features/templating/template_srv';
import { convertToStoreState } from './convertToStoreState';
import { getTemplateSrvDependencies } from './getTemplateSrvDependencies';
export function initTemplateSrv(key, variables, timeRange) {
    const state = convertToStoreState(key, variables);
    const srv = new TemplateSrv(getTemplateSrvDependencies(state));
    srv.init(variables, timeRange);
    return srv;
}
//# sourceMappingURL=initTemplateSrv.js.map