import angular from 'angular';
import { isArray, isNull, isObject, isUndefined } from 'lodash';
import { dateTime } from '@grafana/data';
import { getTemplateSrv } from 'app/features/templating/template_srv';
import coreModule from '../core_module';
coreModule.filter('stringSort', () => {
    return (input) => {
        return input.sort();
    };
});
coreModule.filter('slice', () => {
    return (arr, start, end) => {
        if (!isUndefined(arr)) {
            return arr.slice(start, end);
        }
        return arr;
    };
});
coreModule.filter('stringify', () => {
    return (arr) => {
        if (isObject(arr) && !isArray(arr)) {
            return angular.toJson(arr);
        }
        else {
            return isNull(arr) ? null : arr.toString();
        }
    };
});
coreModule.filter('moment', () => {
    return (date, mode) => {
        switch (mode) {
            case 'ago':
                return dateTime(date).fromNow();
        }
        return dateTime(date).fromNow();
    };
});
function interpolateTemplateVars(templateSrv = getTemplateSrv()) {
    const filterFunc = (text, scope) => {
        let scopedVars;
        if (scope.ctrl) {
            scopedVars = (scope.ctrl.panel || scope.ctrl.row).scopedVars;
        }
        else {
            scopedVars = scope.row.scopedVars;
        }
        return templateSrv.replaceWithText(text, scopedVars);
    };
    filterFunc.$stateful = true;
    return filterFunc;
}
coreModule.filter('interpolateTemplateVars', interpolateTemplateVars);
export default {};
//# sourceMappingURL=filters.js.map