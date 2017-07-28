/**
 * @license AngularJS v1.5.11
 * (c) 2010-2017 Google, Inc. http://angularjs.org
 * License: MIT
 */
(function(window, angular) {'use strict';

/**
 * @ngdoc module
 * @name ngAria
 * @description
 *
 * The `ngAria` module provides support for common
 * [<abbr title="Accessible Rich Internet Applications">ARIA</abbr>](http://www.w3.org/TR/wai-aria/)
 * attributes that convey state or semantic information about the application for users
 * of assistive technologies, such as screen readers.
 *
 * <div doc-module-components="ngAria"></div>
 *
 * ## Usage
 *
 * For ngAria to do its magic, simply include the module `ngAria` as a dependency. The following
 * directives are supported:
 * `ngModel`, `ngChecked`, `ngReadonly`, `ngRequired`, `ngValue`, `ngDisabled`, `ngShow`, `ngHide`, `ngClick`,
 * `ngDblClick`, and `ngMessages`.
 *
 * Below is a more detailed breakdown of the attributes handled by ngAria:
 *
 * | Directive                                   | Supported Attributes                                                                   |
 * |---------------------------------------------|----------------------------------------------------------------------------------------|
 * | {@link ng.directive:ngModel ngModel}        | aria-checked, aria-valuemin, aria-valuemax, aria-valuenow, aria-invalid, aria-required, input roles |
 * | {@link ng.directive:ngDisabled ngDisabled}  | aria-disabled                                                                          |
 * | {@link ng.directive:ngRequired ngRequired}  | aria-required
 * | {@link ng.directive:ngChecked ngChecked}    | aria-checked
 * | {@link ng.directive:ngReadonly ngReadonly}  | aria-readonly                                                                          |
 * | {@link ng.directive:ngValue ngValue}        | aria-checked                                                                           |
 * | {@link ng.directive:ngShow ngShow}          | aria-hidden                                                                            |
 * | {@link ng.directive:ngHide ngHide}          | aria-hidden                                                                            |
 * | {@link ng.directive:ngDblclick ngDblclick}  | tabindex                                                                               |
 * | {@link module:ngMessages ngMessages}        | aria-live                                                                              |
 * | {@link ng.directive:ngClick ngClick}        | tabindex, keypress event, button role                                                  |
 *
 * Find out more information about each directive by reading the
 * {@link guide/accessibility ngAria Developer Guide}.
 *
 * ## Example
 * Using ngDisabled with ngAria:
 * ```html
 * <md-checkbox ng-disabled="disabled">
 * ```
 * Becomes:
 * ```html
 * <md-checkbox ng-disabled="disabled" aria-disabled="true">
 * ```
 *
 * ## Disabling Attributes
 * It's possible to disable individual attributes added by ngAria with the
 * {@link ngAria.$ariaProvider#config config} method. For more details, see the
 * {@link guide/accessibility Developer Guide}.
 */
var ngAriaModule = angular.module('ngAria', ['ng']).
                        provider('$aria', $AriaProvider);

/**
* Internal Utilities
*/
var nodeBlackList = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'SELECT', 'DETAILS', 'SUMMARY'];

var isNodeOneOf = function(elem, nodeTypeArray) {
  if (nodeTypeArray.indexOf(elem[0].nodeName) !== -1) {
    return true;
  }
};
/**
 * @ngdoc provider
 * @name $ariaProvider
 * @this
 *
 * @description
 *
 * Used for configuring the ARIA attributes injected and managed by ngAria.
 *
 * ```js
 * angular.module('myApp', ['ngAria'], function config($ariaProvider) {
 *   $ariaProvider.config({
 *     ariaValue: true,
 *     tabindex: false
 *   });
 * });
 *```
 *
 * ## Dependencies
 * Requires the {@link ngAria} module to be installed.
 *
 */
function $AriaProvider() {
  var config = {
    ariaHidden: true,
    ariaChecked: true,
    ariaReadonly: true,
    ariaDisabled: true,
    ariaRequired: true,
    ariaInvalid: true,
    ariaValue: true,
    tabindex: true,
    bindKeypress: true,
    bindRoleForClick: true
  };

  /**
   * @ngdoc method
   * @name $ariaProvider#config
   *
   * @param {object} config object to enable/disable specific ARIA attributes
   *
   *  - **ariaHidden** – `{boolean}` – Enables/disables aria-hidden tags
   *  - **ariaChecked** – `{boolean}` – Enables/disables aria-checked tags
   *  - **ariaReadonly** – `{boolean}` – Enables/disables aria-readonly tags
   *  - **ariaDisabled** – `{boolean}` – Enables/disables aria-disabled tags
   *  - **ariaRequired** – `{boolean}` – Enables/disables aria-required tags
   *  - **ariaInvalid** – `{boolean}` – Enables/disables aria-invalid tags
   *  - **ariaValue** – `{boolean}` – Enables/disables aria-valuemin, aria-valuemax and aria-valuenow tags
   *  - **tabindex** – `{boolean}` – Enables/disables tabindex tags
   *  - **bindKeypress** – `{boolean}` – Enables/disables keypress event binding on `div` and
   *    `li` elements with ng-click
   *  - **bindRoleForClick** – `{boolean}` – Adds role=button to non-interactive elements like `div`
   *    using ng-click, making them more accessible to users of assistive technologies
   *
   * @description
   * Enables/disables various ARIA attributes
   */
  this.config = function(newConfig) {
    config = angular.extend(config, newConfig);
  };

  function watchExpr(attrName, ariaAttr, nodeBlackList, negate) {
    return function(scope, elem, attr) {
      var ariaCamelName = attr.$normalize(ariaAttr);
      if (config[ariaCamelName] && !isNodeOneOf(elem, nodeBlackList) && !attr[ariaCamelName]) {
        scope.$watch(attr[attrName], function(boolVal) {
          // ensure boolean value
          boolVal = negate ? !boolVal : !!boolVal;
          elem.attr(ariaAttr, boolVal);
        });
      }
    };
  }
  /**
   * @ngdoc service
   * @name $aria
   *
   * @description
   * @priority 200
   *
   * The $aria service contains helper methods for applying common
   * [ARIA](http://www.w3.org/TR/wai-aria/) attributes to HTML directives.
   *
   * ngAria injects common accessibility attributes that tell assistive technologies when HTML
   * elements are enabled, selected, hidden, and more. To see how this is performed with ngAria,
   * let's review a code snippet from ngAria itself:
   *
   *```js
   * ngAriaModule.directive('ngDisabled', ['$aria', function($aria) {
   *   return $aria.$$watchExpr('ngDisabled', 'aria-disabled', nodeBlackList, false);
   * }])
   *```
   * Shown above, the ngAria module creates a directive with the same signature as the
   * traditional `ng-disabled` directive. But this ngAria version is dedicated to
   * solely managing accessibility attributes on custom elements. The internal `$aria` service is
   * used to watch the boolean attribute `ngDisabled`. If it has not been explicitly set by the
   * developer, `aria-disabled` is injected as an attribute with its value synchronized to the
   * value in `ngDisabled`.
   *
   * Because ngAria hooks into the `ng-disabled` directive, developers do not have to do
   * anything to enable this feature. The `aria-disabled` attribute is automatically managed
   * simply as a silent side-effect of using `ng-disabled` with the ngAria module.
   *
   * The full list of directives that interface with ngAria:
   * * **ngModel**
   * * **ngChecked**
   * * **ngReadonly**
   * * **ngRequired**
   * * **ngDisabled**
   * * **ngValue**
   * * **ngShow**
   * * **ngHide**
   * * **ngClick**
   * * **ngDblclick**
   * * **ngMessages**
   *
   * Read the {@link guide/accessibility ngAria Developer Guide} for a thorough explanation of each
   * directive.
   *
   *
   * ## Dependencies
   * Requires the {@link ngAria} module to be installed.
   */
  this.$get = function() {
    return {
      config: function(key) {
        return config[key];
      },
      $$watchExpr: watchExpr
    };
  };
}


ngAriaModule.directive('ngShow', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngShow', 'aria-hidden', [], true);
}])
.directive('ngHide', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngHide', 'aria-hidden', [], false);
}])
.directive('ngValue', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngValue', 'aria-checked', nodeBlackList, false);
}])
.directive('ngChecked', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngChecked', 'aria-checked', nodeBlackList, false);
}])
.directive('ngReadonly', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngReadonly', 'aria-readonly', nodeBlackList, false);
}])
.directive('ngRequired', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngRequired', 'aria-required', nodeBlackList, false);
}])
.directive('ngModel', ['$aria', function($aria) {

  function shouldAttachAttr(attr, normalizedAttr, elem, allowBlacklistEls) {
    return $aria.config(normalizedAttr) && !elem.attr(attr) && (allowBlacklistEls || !isNodeOneOf(elem, nodeBlackList));
  }

  function shouldAttachRole(role, elem) {
    // if element does not have role attribute
    // AND element type is equal to role (if custom element has a type equaling shape) <-- remove?
    // AND element is not INPUT
    return !elem.attr('role') && (elem.attr('type') === role) && (elem[0].nodeName !== 'INPUT');
  }

  function getShape(attr, elem) {
    var type = attr.type,
        role = attr.role;

    return ((type || role) === 'checkbox' || role === 'menuitemcheckbox') ? 'checkbox' :
           ((type || role) === 'radio'    || role === 'menuitemradio') ? 'radio' :
           (type === 'range'              || role === 'progressbar' || role === 'slider') ? 'range' : '';
  }

  return {
    restrict: 'A',
    require: 'ngModel',
    priority: 200, //Make sure watches are fired after any other directives that affect the ngModel value
    compile: function(elem, attr) {
      var shape = getShape(attr, elem);

      return {
        pre: function(scope, elem, attr, ngModel) {
          if (shape === 'checkbox') {
            //Use the input[checkbox] $isEmpty implementation for elements with checkbox roles
            ngModel.$isEmpty = function(value) {
              return value === false;
            };
          }
        },
        post: function(scope, elem, attr, ngModel) {
          var needsTabIndex = shouldAttachAttr('tabindex', 'tabindex', elem, false);

          function ngAriaWatchModelValue() {
            return ngModel.$modelValue;
          }

          function getRadioReaction(newVal) {
            // Strict comparison would cause a BC
            // eslint-disable-next-line eqeqeq
            var boolVal = (attr.value == ngModel.$viewValue);
            elem.attr('aria-checked', boolVal);
          }

          function getCheckboxReaction() {
            elem.attr('aria-checked', !ngModel.$isEmpty(ngModel.$viewValue));
          }

          switch (shape) {
            case 'radio':
            case 'checkbox':
              if (shouldAttachRole(shape, elem)) {
                elem.attr('role', shape);
              }
              if (shouldAttachAttr('aria-checked', 'ariaChecked', elem, false)) {
                scope.$watch(ngAriaWatchModelValue, shape === 'radio' ?
                    getRadioReaction : getCheckboxReaction);
              }
              if (needsTabIndex) {
                elem.attr('tabindex', 0);
              }
              break;
            case 'range':
              if (shouldAttachRole(shape, elem)) {
                elem.attr('role', 'slider');
              }
              if ($aria.config('ariaValue')) {
                var needsAriaValuemin = !elem.attr('aria-valuemin') &&
                    (attr.hasOwnProperty('min') || attr.hasOwnProperty('ngMin'));
                var needsAriaValuemax = !elem.attr('aria-valuemax') &&
                    (attr.hasOwnProperty('max') || attr.hasOwnProperty('ngMax'));
                var needsAriaValuenow = !elem.attr('aria-valuenow');

                if (needsAriaValuemin) {
                  attr.$observe('min', function ngAriaValueMinReaction(newVal) {
                    elem.attr('aria-valuemin', newVal);
                  });
                }
                if (needsAriaValuemax) {
                  attr.$observe('max', function ngAriaValueMinReaction(newVal) {
                    elem.attr('aria-valuemax', newVal);
                  });
                }
                if (needsAriaValuenow) {
                  scope.$watch(ngAriaWatchModelValue, function ngAriaValueNowReaction(newVal) {
                    elem.attr('aria-valuenow', newVal);
                  });
                }
              }
              if (needsTabIndex) {
                elem.attr('tabindex', 0);
              }
              break;
          }

          if (!attr.hasOwnProperty('ngRequired') && ngModel.$validators.required
            && shouldAttachAttr('aria-required', 'ariaRequired', elem, false)) {
            // ngModel.$error.required is undefined on custom controls
            attr.$observe('required', function() {
              elem.attr('aria-required', !!attr['required']);
            });
          }

          if (shouldAttachAttr('aria-invalid', 'ariaInvalid', elem, true)) {
            scope.$watch(function ngAriaInvalidWatch() {
              return ngModel.$invalid;
            }, function ngAriaInvalidReaction(newVal) {
              elem.attr('aria-invalid', !!newVal);
            });
          }
        }
      };
    }
  };
}])
.directive('ngDisabled', ['$aria', function($aria) {
  return $aria.$$watchExpr('ngDisabled', 'aria-disabled', nodeBlackList, false);
}])
.directive('ngMessages', function() {
  return {
    restrict: 'A',
    require: '?ngMessages',
    link: function(scope, elem, attr, ngMessages) {
      if (!elem.attr('aria-live')) {
        elem.attr('aria-live', 'assertive');
      }
    }
  };
})
.directive('ngClick',['$aria', '$parse', function($aria, $parse) {
  return {
    restrict: 'A',
    compile: function(elem, attr) {
      var fn = $parse(attr.ngClick, /* interceptorFn */ null, /* expensiveChecks */ true);
      return function(scope, elem, attr) {

        if (!isNodeOneOf(elem, nodeBlackList)) {

          if ($aria.config('bindRoleForClick') && !elem.attr('role')) {
            elem.attr('role', 'button');
          }

          if ($aria.config('tabindex') && !elem.attr('tabindex')) {
            elem.attr('tabindex', 0);
          }

          if ($aria.config('bindKeypress') && !attr.ngKeypress) {
            elem.on('keypress', function(event) {
              var keyCode = event.which || event.keyCode;
              if (keyCode === 32 || keyCode === 13) {
                scope.$apply(callback);
              }

              function callback() {
                fn(scope, { $event: event });
              }
            });
          }
        }
      };
    }
  };
}])
.directive('ngDblclick', ['$aria', function($aria) {
  return function(scope, elem, attr) {
    if ($aria.config('tabindex') && !elem.attr('tabindex') && !isNodeOneOf(elem, nodeBlackList)) {
      elem.attr('tabindex', 0);
    }
  };
}]);


})(window, window.angular);