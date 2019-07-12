import _ from 'lodash';
import angular from 'angular';
import coreModule from '../core_module';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { dateTime } from '@grafana/data';

coreModule.filter('stringSort', () => {
  return (input: any) => {
    return input.sort();
  };
});

coreModule.filter('slice', () => {
  return (arr: any[], start: any, end: any) => {
    if (!_.isUndefined(arr)) {
      return arr.slice(start, end);
    }
    return arr;
  };
});

coreModule.filter('stringify', () => {
  return (arr: any[]) => {
    if (_.isObject(arr) && !_.isArray(arr)) {
      return angular.toJson(arr);
    } else {
      return _.isNull(arr) ? null : arr.toString();
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

/** @ngInject */
function interpolateTemplateVars(templateSrv: TemplateSrv) {
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
