///<reference path="../../../headers/common.d.ts" />

import {coreModule} from 'app/core/core';

var template = `
<div class="gf-form-select-wrapper max-width-13">
<select class="gf-form-input" ng-model="model.repeat" ng-options="f.value as f.text for f in variables">
<option value=""></option>
</div>
`;

/** @ngInject **/
function dashRepeatOptionDirective(variableSrv) {
  return {
    restrict: 'E',
    template: template,
    scope: {
      model: "=",
    },
    link: function(scope, element) {
      element.css({display: 'block', width: '100%'});

      scope.variables = variableSrv.variables.map(item => {
        return {text: item.name, value: item.name};
      });

      if (scope.variables.length === 0) {
        scope.variables.unshift({text: 'No template variables found', value: null});
      }

      scope.variables.unshift({text: 'Disabled', value: null});
    }
  };
}

coreModule.directive('dashRepeatOption', dashRepeatOptionDirective);
