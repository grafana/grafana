/**
 * @license
 * Copyright AdRem Software. All Rights Reserved.
 *
 * Use of this source code is governed by an Apache License, Version 2.0 that can be
 * found in the LICENSE file.
 */

import angular from 'angular';
import { directivesModule } from '../common';

const
  PRIVATE_PROPERTIES = {
    timeout: Symbol('timeout'),
    parse: Symbol('parse')
  },
  NC_FOCUS_DI = ['$timeout', '$parse'];

class NcFocus {

  constructor($timeout, $parse) {
    this.restrict = 'A';
    this.scope = false;
    this[PRIVATE_PROPERTIES.timeout] = $timeout;
    this[PRIVATE_PROPERTIES.parse] = $parse;
  }

  link($scope, $element, $attributes) {
    const
      self = this,
      focusMeModel = self[PRIVATE_PROPERTIES.parse]($attributes.ncFocus),
      focusChild = (($attributes.ncFocusChild != null) &&
                    ($attributes.ncFocusChild !== '')) ? Number($attributes.ncFocusChild) : null;

    $scope.$watch($attributes.ncFocus, (value) => {
      if (value === true) {
        self[PRIVATE_PROPERTIES.timeout](() => {
          if (Number.isInteger(focusChild)) {
            $element[0].children[focusChild].focus();
          } else {
            $element[0].focus();
          }
          focusMeModel.assign($scope, false);
        }, 0);
      }
    });
  }
}

angular
  .module(directivesModule)
    .directive('ncFocus', [...NC_FOCUS_DI, ($timeout, $parse) => new NcFocus($timeout, $parse)]);
