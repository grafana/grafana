///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';

import {coreModule} from 'app/core/core';

export class RowOptionsCtrl {
}

export function rowOptionsDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/row/options.html',
    controller: RowOptionsCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      row: "=",
      onClose: "&"
    },
  };
}

coreModule.directive('dashRowOptions', rowOptionsDirective);
