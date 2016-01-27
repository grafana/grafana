///<reference path="../../../headers/common.d.ts" />

import moment from 'moment';

export function inputDateDirective() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function ($scope, $elem, attrs, ngModel) {
      var format = 'YYYY-MM-DD HH:mm:ss';

      var fromUser = function (text) {
        if (text.indexOf('now') !== -1) {
          return text;
        }
        var parsed;
        if ($scope.ctrl.isUtc) {
          parsed = moment.utc(text, format);
        } else {
          parsed = moment(text, format);
        }

        return parsed.isValid() ? parsed : undefined;
      };

      var toUser = function (currentValue) {
        if (moment.isMoment(currentValue)) {
          return currentValue.format(format);
        } else {
          return currentValue;
        }
      };

      ngModel.$parsers.push(fromUser);
      ngModel.$formatters.push(toUser);
    }
  };
}

