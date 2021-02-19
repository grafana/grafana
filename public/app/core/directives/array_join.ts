import _ from 'lodash';
import coreModule from '../core_module';

export function arrayJoin() {
  'use strict';

  return {
    restrict: 'A',
    require: 'ngModel',
    link: (scope: any, element: any, attr: any, ngModel: any) => {
      function split_array(text: string) {
        return (text || '').split(',');
      }

      function join_array(text: string) {
        if (_.isArray(text)) {
          return ((text || '') as any).join(',');
        } else {
          return text;
        }
      }

      ngModel.$parsers.push(split_array);
      ngModel.$formatters.push(join_array);
    },
  };
}

coreModule.directive('arrayJoin', arrayJoin);
