import angular from 'angular';
import { isArray, isNull, isObject, isUndefined } from 'lodash';

import { dateTime } from '@grafana/data';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import coreModule from '../core_module';

coreModule.filter('stringSort', () => {
  return (input: any) => {
    return input.sort();
  };
});

coreModule.filter('slice', () => {
  return (arr: any[], start: any, end: any) => {
    if (!isUndefined(arr)) {
      return arr.slice(start, end);
    }
    return arr;
  };
});

coreModule.filter('stringify', () => {
  return (arr: any[]) => {
    if (isObject(arr) && !isArray(arr)) {
      return angular.toJson(arr);
    } else {
      return isNull(arr) ? null : arr.toString();
    }
  };
});

coreModule.filter('moment', () => {
  return (date: string, mode: string) => {
    switch (mode) {
      case 'ago':
        return dateTime(date).fromNow();
    }
    return dateTime(date).fromNow();
  };
});

function interpolateTemplateVars(templateSrv: TemplateSrv = getTemplateSrv()) {
  const filterFunc: any = (text: string, scope: any) => {
    let scopedVars;
    if (scope.ctrl) {
      scopedVars = (scope.ctrl.panel || scope.ctrl.row).scopedVars;
    } else {
      scopedVars = scope.row.scopedVars;
    }

    return templateSrv.replaceWithText(text, scopedVars);
  };

  filterFunc.$stateful = true;
  return filterFunc;
}

coreModule.filter('interpolateTemplateVars', interpolateTemplateVars);
export default {};
