import _ from 'lodash';
import angular from 'angular';
import moment from 'moment';
import coreModule from '../core_module';

coreModule.filter('stringSort', () => {
  return input => {
    return input.sort();
  };
});

coreModule.filter('slice', () => {
  return (arr, start, end) => {
    if (!_.isUndefined(arr)) {
      return arr.slice(start, end);
    }
  };
});

coreModule.filter('stringify', () => {
  return arr => {
    if (_.isObject(arr) && !_.isArray(arr)) {
      return angular.toJson(arr);
    } else {
      return _.isNull(arr) ? null : arr.toString();
    }
  };
});

coreModule.filter('moment', () => {
  return (date, mode) => {
    switch (mode) {
      case 'ago':
        return moment(date).fromNow();
    }
    return moment(date).fromNow();
  };
});

coreModule.filter('noXml', () => {
  const noXml = text => {
    return _.isString(text)
      ? text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/'/g, '&#39;')
          .replace(/"/g, '&quot;')
      : text;
  };
  return text => {
    return _.isArray(text) ? _.map(text, noXml) : noXml(text);
  };
});

/** @ngInject */
function interpolateTemplateVars(templateSrv) {
  const filterFunc: any = (text, scope) => {
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
