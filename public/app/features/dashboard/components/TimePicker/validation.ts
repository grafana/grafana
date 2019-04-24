import moment from 'moment';
import * as dateMath from 'app/core/utils/datemath';

export function inputDateDirective() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: ($scope, $elem, attrs, ngModel) => {
      const format = 'YYYY-MM-DD HH:mm:ss';

      const fromUser = text => {
        if (text.indexOf('now') !== -1) {
          if (!dateMath.isValid(text)) {
            ngModel.$setValidity('error', false);
            return undefined;
          }
          ngModel.$setValidity('error', true);
          return text;
        }

        let parsed;
        if ($scope.ctrl.isUtc) {
          parsed = moment.utc(text, format);
        } else {
          parsed = moment(text, format);
        }

        if (!parsed.isValid()) {
          ngModel.$setValidity('error', false);
          return undefined;
        }

        ngModel.$setValidity('error', true);
        return parsed;
      };

      const toUser = currentValue => {
        if (moment.isMoment(currentValue)) {
          return currentValue.format(format);
        } else {
          return currentValue;
        }
      };

      ngModel.$parsers.push(fromUser);
      ngModel.$formatters.push(toUser);
    },
  };
}
