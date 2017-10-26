import coreModule from '../core_module';

export class ConfirmClick {
  constructor() {
    return {
      restrict: 'A',
      link: function(scope, elem, attrs) {
        elem.bind('click', function() {
          var message = attrs.confirmation || "Are you sure you want to do that?";
          if (window.confirm(message)) {
            var action = attrs.confirmClick;
            if (action) {
              scope.$apply(scope.$eval(action));
            }
          }
        });
      },
    };
  }
}

coreModule.directive('confirmClick', ConfirmClick);
