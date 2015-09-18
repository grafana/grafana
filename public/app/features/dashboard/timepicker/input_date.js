define([
  "angular",
  "lodash",
  "moment",
],function (angular, _, moment) {
  'use strict';

  angular.
    module("grafana.directives").
    directive('inputDatetime', function () {
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function ($scope, $elem, attrs, ngModel) {
        var format = 'YYYY-MM-DD HH:mm:ss';
        // $elem.after('<div class="input-datetime-format">' + format + '</div>');

        // What should I make with the input from the user?
        var fromUser = function (text) {
          console.log('fromUser: ' + text);
          return text;
          // if (_.isString(text)) {
          // }
          // var parsed = moment(text, format);
          // return parsed.isValid() ? parsed : undefined;
        };

        // How should I present the data back to the user in the input field?
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
  });
});
