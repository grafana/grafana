/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import angular from 'angular';
import { imagesURL, directivesModule } from '../common';

const
  PRIVATE_PROPERTIES = {
    showTimer: Symbol('showTimer'),
    spinnerState: Symbol('spinnerState'),
    timeout: Symbol('timeout')
  },
  NC_SPINNER_CONTROLLER_DI = ['$scope', '$timeout'];

class NcSpinnerController {

  constructor($scope, $timeout) {

    this[PRIVATE_PROPERTIES.showTimer] = null;
    this[PRIVATE_PROPERTIES.spinnerState] = false;
    this[PRIVATE_PROPERTIES.timeout] = $timeout;

    $scope.$watch('ncSpinnerCtrl.spinnerShowTrigger', (showTrigger) => {
      if (showTrigger) {
        this.showSpinner();
      } else {
        this.hideSpinner();
      }
    });

  }

  showSpinner() {
    const timeout = this[PRIVATE_PROPERTIES.timeout];

    if (this[PRIVATE_PROPERTIES.showTimer] === null) {
      this[PRIVATE_PROPERTIES.showTimer] = timeout(() => {
        this[PRIVATE_PROPERTIES.spinnerState] = true;
        this[PRIVATE_PROPERTIES.showTimer] = null;
        this.spinnerOnChange({ state: true });
      }, this.delay);
    }
  }

  hideSpinner() {
    const
      showTimer = this[PRIVATE_PROPERTIES.showTimer],
      timeout = this[PRIVATE_PROPERTIES.timeout];

    if (showTimer != null) {
      timeout.cancel(showTimer);
      this[PRIVATE_PROPERTIES.showTimer] = null;
    }

    this[PRIVATE_PROPERTIES.spinnerState] = false;
    this.spinnerOnChange({ state: false });
  }

  get delay() {
    const delay = Number(this.spinnerDelay);
    return angular.isNumber(delay) ? delay : 200;
  }

  get spinnerState() {
    return this[PRIVATE_PROPERTIES.spinnerState];
  }

}

NcSpinnerController.$inject = NC_SPINNER_CONTROLLER_DI;

class NcSpinner {

  constructor() {

    this.restrict = 'E';

    this.scope = {
      spinnerShowTrigger: '<',
      spinnerDelay: '@',
      spinnerOnChange: '&'
    };

    this.template = `
      <div class="gf-form-label" ng-if="ncSpinnerCtrl.spinnerState">
        <img src=${imagesURL}load_big.gif/>
      </div>
    `;

    this.controller = NcSpinnerController;
    this.controllerAs = 'ncSpinnerCtrl';
    this.bindToController = true;

  }

}

angular
  .module(directivesModule)
    .directive('ncSpinner', () => new NcSpinner());
