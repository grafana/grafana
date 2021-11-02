import { convertToStoreState } from './convertToStoreState';
import { TemplateSrv } from '../../app/features/templating/template_srv';
import { getTemplateSrvDependencies } from './getTemplateSrvDependencies';
export function initTemplateSrv(variables, timeRange) {
    var state = convertToStoreState(variables);
    var srv = new TemplateSrv(getTemplateSrvDependencies(state));
    srv.init(variables, timeRange);
    return srv;
}
//# sourceMappingURL=initTemplateSrv.js.map