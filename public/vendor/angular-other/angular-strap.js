/**
 * angular-strap
 * @version v2.3.12 - 2017-01-26
 * @link http://mgcrea.github.io/angular-strap
 * @author Olivier Louvignes <olivier@mg-crea.com> (https://github.com/mgcrea)
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
(function(window, document, undefined) {
  'use strict';
  bsCompilerService.$inject = [ '$q', '$http', '$injector', '$compile', '$controller', '$templateCache' ];
  angular.module('mgcrea.ngStrap.typeahead', [ 'mgcrea.ngStrap.tooltip', 'mgcrea.ngStrap.helpers.parseOptions' ]).provider('$typeahead', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      prefixClass: 'typeahead',
      prefixEvent: '$typeahead',
      placement: 'bottom-left',
      templateUrl: 'typeahead/typeahead.tpl.html',
      trigger: 'focus',
      container: false,
      keyboard: true,
      html: false,
      delay: 0,
      minLength: 1,
      filter: 'bsAsyncFilter',
      limit: 6,
      autoSelect: false,
      comparator: '',
      trimValue: true
    };
    this.$get = [ '$window', '$rootScope', '$tooltip', '$$rAF', '$timeout', function($window, $rootScope, $tooltip, $$rAF, $timeout) {
      function TypeaheadFactory(element, controller, config) {
        var $typeahead = {};
        var options = angular.extend({}, defaults, config);
        $typeahead = $tooltip(element, options);
        var parentScope = config.scope;
        var scope = $typeahead.$scope;
        scope.$resetMatches = function() {
          scope.$matches = [];
          scope.$activeIndex = options.autoSelect ? 0 : -1;
        };
        scope.$resetMatches();
        scope.$activate = function(index) {
          scope.$$postDigest(function() {
            $typeahead.activate(index);
          });
        };
        scope.$select = function(index, evt) {
          scope.$$postDigest(function() {
            $typeahead.select(index);
          });
        };
        scope.$isVisible = function() {
          return $typeahead.$isVisible();
        };
        $typeahead.update = function(matches) {
          scope.$matches = matches;
          if (scope.$activeIndex >= matches.length) {
            scope.$activeIndex = options.autoSelect ? 0 : -1;
          }
          safeDigest(scope);
          $$rAF($typeahead.$applyPlacement);
        };
        $typeahead.activate = function(index) {
          scope.$activeIndex = index;
        };
        $typeahead.select = function(index) {
          if (index === -1) return;
          var value = scope.$matches[index].value;
          controller.$setViewValue(value);
          controller.$render();
          scope.$resetMatches();
          if (parentScope) parentScope.$digest();
          scope.$emit(options.prefixEvent + '.select', value, index, $typeahead);
          if (angular.isDefined(options.onSelect) && angular.isFunction(options.onSelect)) {
            options.onSelect(value, index, $typeahead);
          }
        };
        $typeahead.$isVisible = function() {
          if (!options.minLength || !controller) {
            return !!scope.$matches.length;
          }
          return scope.$matches.length && angular.isString(controller.$viewValue) && controller.$viewValue.length >= options.minLength;
        };
        $typeahead.$getIndex = function(value) {
          var index;
          for (index = scope.$matches.length; index--; ) {
            if (angular.equals(scope.$matches[index].value, value)) break;
          }
          return index;
        };
        $typeahead.$onMouseDown = function(evt) {
          evt.preventDefault();
          evt.stopPropagation();
        };
        $typeahead.$$updateScrollTop = function(container, index) {
          if (index > -1 && index < container.children.length) {
            var active = container.children[index];
            var clientTop = active.offsetTop;
            var clientBottom = active.offsetTop + active.clientHeight;
            var highWatermark = container.scrollTop;
            var lowWatermark = container.scrollTop + container.clientHeight;
            if (clientBottom >= highWatermark && clientTop < highWatermark) {
              container.scrollTop = Math.max(0, container.scrollTop - container.clientHeight);
            } else if (clientBottom > lowWatermark) {
              container.scrollTop = clientTop;
            }
          }
        };
        $typeahead.$onKeyDown = function(evt) {
          if (!/(38|40|13)/.test(evt.keyCode)) return;
          if ($typeahead.$isVisible() && !(evt.keyCode === 13 && scope.$activeIndex === -1)) {
            evt.preventDefault();
            evt.stopPropagation();
          }
          if (evt.keyCode === 13 && scope.$matches.length) {
            $typeahead.select(scope.$activeIndex);
          } else if (evt.keyCode === 38 && scope.$activeIndex > 0) {
            scope.$activeIndex--;
          } else if (evt.keyCode === 40 && scope.$activeIndex < scope.$matches.length - 1) {
            scope.$activeIndex++;
          } else if (angular.isUndefined(scope.$activeIndex)) {
            scope.$activeIndex = 0;
          }
          $typeahead.$$updateScrollTop($typeahead.$element[0], scope.$activeIndex);
          scope.$digest();
        };
        var show = $typeahead.show;
        $typeahead.show = function() {
          show();
          $timeout(function() {
            if ($typeahead.$element) {
              $typeahead.$element.on('mousedown', $typeahead.$onMouseDown);
              if (options.keyboard) {
                if (element) element.on('keydown', $typeahead.$onKeyDown);
              }
            }
          }, 0, false);
        };
        var hide = $typeahead.hide;
        $typeahead.hide = function() {
          if ($typeahead.$element) $typeahead.$element.off('mousedown', $typeahead.$onMouseDown);
          if (options.keyboard) {
            if (element) element.off('keydown', $typeahead.$onKeyDown);
          }
          if (!options.autoSelect) {
            $typeahead.activate(-1);
          }
          hide();
        };
        return $typeahead;
      }
      function safeDigest(scope) {
        scope.$$phase || scope.$root && scope.$root.$$phase || scope.$digest();
      }
      TypeaheadFactory.defaults = defaults;
      return TypeaheadFactory;
    } ];
  }).filter('bsAsyncFilter', [ '$filter', function($filter) {
    return function(array, expression, comparator) {
      if (array && angular.isFunction(array.then)) {
        return array.then(function(results) {
          return $filter('filter')(results, expression, comparator);
        });
      }
      return $filter('filter')(array, expression, comparator);
    };
  } ]).directive('bsTypeahead', [ '$window', '$parse', '$q', '$typeahead', '$parseOptions', function($window, $parse, $q, $typeahead, $parseOptions) {
    var defaults = $typeahead.defaults;
    return {
      restrict: 'EAC',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        element.off('change');
        var options = {
          scope: scope
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'placement', 'container', 'delay', 'trigger', 'keyboard', 'html', 'animation', 'filter', 'limit', 'minLength', 'watchOptions', 'selectMode', 'autoSelect', 'comparator', 'id', 'prefixEvent', 'prefixClass' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'html', 'container', 'trimValue', 'filter' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) options[key] = false;
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide', 'onSelect' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        if (!element.attr('autocomplete')) element.attr('autocomplete', 'off');
        var filter = angular.isDefined(options.filter) ? options.filter : defaults.filter;
        var limit = options.limit || defaults.limit;
        var comparator = options.comparator || defaults.comparator;
        var bsOptions = attr.bsOptions;
        if (filter) {
          bsOptions += ' | ' + filter + ':$viewValue';
          if (comparator) bsOptions += ':' + comparator;
        }
        if (limit) bsOptions += ' | limitTo:' + limit;
        var parsedOptions = $parseOptions(bsOptions);
        var typeahead = $typeahead(element, controller, options);
        if (options.watchOptions) {
          var watchedOptions = parsedOptions.$match[7].replace(/\|.+/, '').replace(/\(.*\)/g, '').trim();
          scope.$watchCollection(watchedOptions, function(newValue, oldValue) {
            parsedOptions.valuesFn(scope, controller).then(function(values) {
              typeahead.update(values);
              controller.$render();
            });
          });
        }
        scope.$watch(attr.ngModel, function(newValue, oldValue) {
          scope.$modelValue = newValue;
          parsedOptions.valuesFn(scope, controller).then(function(values) {
            if (options.selectMode && !values.length && newValue.length > 0) {
              controller.$setViewValue(controller.$viewValue.substring(0, controller.$viewValue.length - 1));
              return;
            }
            if (values.length > limit) values = values.slice(0, limit);
            typeahead.update(values);
            controller.$render();
          });
        });
        controller.$formatters.push(function(modelValue) {
          var displayValue = parsedOptions.displayValue(modelValue);
          if (displayValue) {
            return displayValue;
          }
          if (angular.isDefined(modelValue) && typeof modelValue !== 'object') {
            return modelValue;
          }
          return '';
        });
        controller.$render = function() {
          if (controller.$isEmpty(controller.$viewValue)) {
            return element.val('');
          }
          var index = typeahead.$getIndex(controller.$modelValue);
          var selected = index !== -1 ? typeahead.$scope.$matches[index].label : controller.$viewValue;
          selected = angular.isObject(selected) ? parsedOptions.displayValue(selected) : selected;
          var value = selected ? selected.toString().replace(/<(?:.|\n)*?>/gm, '') : '';
          var ss = element[0].selectionStart;
          var sd = element[0].selectionEnd;
          element.val(options.trimValue === false ? value : value.trim());
          element[0].setSelectionRange(ss, sd);
        };
        scope.$on('$destroy', function() {
          if (typeahead) typeahead.destroy();
          options = null;
          typeahead = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.tooltip', [ 'mgcrea.ngStrap.core', 'mgcrea.ngStrap.helpers.dimensions' ]).provider('$tooltip', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      customClass: '',
      prefixClass: 'tooltip',
      prefixEvent: 'tooltip',
      container: false,
      target: false,
      placement: 'top',
      templateUrl: 'tooltip/tooltip.tpl.html',
      template: '',
      titleTemplate: false,
      trigger: 'hover focus',
      keyboard: false,
      html: false,
      show: false,
      title: '',
      type: '',
      delay: 0,
      autoClose: false,
      bsEnabled: true,
      mouseDownPreventDefault: true,
      mouseDownStopPropagation: true,
      viewport: {
        selector: 'body',
        padding: 0
      }
    };
    this.$get = [ '$window', '$rootScope', '$bsCompiler', '$q', '$templateCache', '$http', '$animate', '$sce', 'dimensions', '$$rAF', '$timeout', function($window, $rootScope, $bsCompiler, $q, $templateCache, $http, $animate, $sce, dimensions, $$rAF, $timeout) {
      var isNative = /(ip[ao]d|iphone|android)/gi.test($window.navigator.userAgent);
      var isTouch = 'createTouch' in $window.document && isNative;
      var $body = angular.element($window.document);
      function TooltipFactory(element, config) {
        var $tooltip = {};
        var options = $tooltip.$options = angular.extend({}, defaults, config);
        var promise = $tooltip.$promise = $bsCompiler.compile(options);
        var scope = $tooltip.$scope = options.scope && options.scope.$new() || $rootScope.$new();
        var nodeName = element[0].nodeName.toLowerCase();
        if (options.delay && angular.isString(options.delay)) {
          var split = options.delay.split(',').map(parseFloat);
          options.delay = split.length > 1 ? {
            show: split[0],
            hide: split[1]
          } : split[0];
        }
        $tooltip.$id = options.id || element.attr('id') || '';
        if (options.title) {
          scope.title = $sce.trustAsHtml(options.title);
        }
        scope.$setEnabled = function(isEnabled) {
          scope.$$postDigest(function() {
            $tooltip.setEnabled(isEnabled);
          });
        };
        scope.$hide = function() {
          scope.$$postDigest(function() {
            $tooltip.hide();
          });
        };
        scope.$show = function() {
          scope.$$postDigest(function() {
            $tooltip.show();
          });
        };
        scope.$toggle = function() {
          scope.$$postDigest(function() {
            $tooltip.toggle();
          });
        };
        $tooltip.$isShown = scope.$isShown = false;
        var timeout;
        var hoverState;
        var compileData;
        var tipElement;
        var tipContainer;
        var tipScope;
        promise.then(function(data) {
          compileData = data;
          $tooltip.init();
        });
        $tooltip.init = function() {
          if (options.delay && angular.isNumber(options.delay)) {
            options.delay = {
              show: options.delay,
              hide: options.delay
            };
          }
          if (options.container === 'self') {
            tipContainer = element;
          } else if (angular.isElement(options.container)) {
            tipContainer = options.container;
          } else if (options.container) {
            tipContainer = findElement(options.container);
          }
          bindTriggerEvents();
          if (options.target) {
            options.target = angular.isElement(options.target) ? options.target : findElement(options.target);
          }
          if (options.show) {
            scope.$$postDigest(function() {
              if (options.trigger === 'focus') {
                element[0].focus();
              } else {
                $tooltip.show();
              }
            });
          }
        };
        $tooltip.destroy = function() {
          unbindTriggerEvents();
          destroyTipElement();
          scope.$destroy();
        };
        $tooltip.enter = function() {
          clearTimeout(timeout);
          hoverState = 'in';
          if (!options.delay || !options.delay.show) {
            return $tooltip.show();
          }
          timeout = setTimeout(function() {
            if (hoverState === 'in') $tooltip.show();
          }, options.delay.show);
        };
        $tooltip.show = function() {
          if (!options.bsEnabled || $tooltip.$isShown) return;
          scope.$emit(options.prefixEvent + '.show.before', $tooltip);
          if (angular.isDefined(options.onBeforeShow) && angular.isFunction(options.onBeforeShow)) {
            options.onBeforeShow($tooltip);
          }
          var parent;
          var after;
          if (options.container) {
            parent = tipContainer;
            if (tipContainer[0].lastChild) {
              after = angular.element(tipContainer[0].lastChild);
            } else {
              after = null;
            }
          } else {
            parent = null;
            after = element;
          }
          if (tipElement) destroyTipElement();
          tipScope = $tooltip.$scope.$new();
          tipElement = $tooltip.$element = compileData.link(tipScope, function(clonedElement, scope) {});
          tipElement.css({
            top: '-9999px',
            left: '-9999px',
            right: 'auto',
            display: 'block',
            visibility: 'hidden'
          });
          if (options.animation) tipElement.addClass(options.animation);
          if (options.type) tipElement.addClass(options.prefixClass + '-' + options.type);
          if (options.customClass) tipElement.addClass(options.customClass);
          if (after) {
            after.after(tipElement);
          } else {
            parent.prepend(tipElement);
          }
          $tooltip.$isShown = scope.$isShown = true;
          safeDigest(scope);
          $tooltip.$applyPlacement();
          if (angular.version.minor <= 2) {
            $animate.enter(tipElement, parent, after, enterAnimateCallback);
          } else {
            $animate.enter(tipElement, parent, after).then(enterAnimateCallback);
          }
          safeDigest(scope);
          $$rAF(function() {
            if (tipElement) tipElement.css({
              visibility: 'visible'
            });
            if (options.keyboard) {
              if (options.trigger !== 'focus') {
                $tooltip.focus();
              }
              bindKeyboardEvents();
            }
          });
          if (options.autoClose) {
            bindAutoCloseEvents();
          }
        };
        function enterAnimateCallback() {
          scope.$emit(options.prefixEvent + '.show', $tooltip);
          if (angular.isDefined(options.onShow) && angular.isFunction(options.onShow)) {
            options.onShow($tooltip);
          }
        }
        $tooltip.leave = function() {
          clearTimeout(timeout);
          hoverState = 'out';
          if (!options.delay || !options.delay.hide) {
            return $tooltip.hide();
          }
          timeout = setTimeout(function() {
            if (hoverState === 'out') {
              $tooltip.hide();
            }
          }, options.delay.hide);
        };
        var _blur;
        var _tipToHide;
        $tooltip.hide = function(blur) {
          if (!$tooltip.$isShown) return;
          scope.$emit(options.prefixEvent + '.hide.before', $tooltip);
          if (angular.isDefined(options.onBeforeHide) && angular.isFunction(options.onBeforeHide)) {
            options.onBeforeHide($tooltip);
          }
          _blur = blur;
          _tipToHide = tipElement;
          if (tipElement !== null) {
            if (angular.version.minor <= 2) {
              $animate.leave(tipElement, leaveAnimateCallback);
            } else {
              $animate.leave(tipElement).then(leaveAnimateCallback);
            }
          }
          $tooltip.$isShown = scope.$isShown = false;
          safeDigest(scope);
          if (options.keyboard && tipElement !== null) {
            unbindKeyboardEvents();
          }
          if (options.autoClose && tipElement !== null) {
            unbindAutoCloseEvents();
          }
        };
        function leaveAnimateCallback() {
          scope.$emit(options.prefixEvent + '.hide', $tooltip);
          if (angular.isDefined(options.onHide) && angular.isFunction(options.onHide)) {
            options.onHide($tooltip);
          }
          if (tipElement === _tipToHide) {
            if (_blur && options.trigger === 'focus') {
              return element[0].blur();
            }
            destroyTipElement();
          }
        }
        $tooltip.toggle = function(evt) {
          if (evt) {
            evt.preventDefault();
          }
          if ($tooltip.$isShown) {
            $tooltip.leave();
          } else {
            $tooltip.enter();
          }
        };
        $tooltip.focus = function() {
          tipElement[0].focus();
        };
        $tooltip.setEnabled = function(isEnabled) {
          options.bsEnabled = isEnabled;
        };
        $tooltip.setViewport = function(viewport) {
          options.viewport = viewport;
        };
        $tooltip.$applyPlacement = function() {
          if (!tipElement) return;
          var placement = options.placement;
          var autoToken = /\s?auto?\s?/i;
          var autoPlace = autoToken.test(placement);
          if (autoPlace) {
            placement = placement.replace(autoToken, '') || defaults.placement;
          }
          tipElement.addClass(options.placement);
          var elementPosition = getPosition();
          var tipWidth = tipElement.prop('offsetWidth');
          var tipHeight = tipElement.prop('offsetHeight');
          $tooltip.$viewport = options.viewport && findElement(options.viewport.selector || options.viewport);
          if (autoPlace) {
            var originalPlacement = placement;
            var viewportPosition = getPosition($tooltip.$viewport);
            if (/bottom/.test(originalPlacement) && elementPosition.bottom + tipHeight > viewportPosition.bottom) {
              placement = originalPlacement.replace('bottom', 'top');
            } else if (/top/.test(originalPlacement) && elementPosition.top - tipHeight < viewportPosition.top) {
              placement = originalPlacement.replace('top', 'bottom');
            }
            if (/left/.test(originalPlacement) && elementPosition.left - tipWidth < viewportPosition.left) {
              placement = placement.replace('left', 'right');
            } else if (/right/.test(originalPlacement) && elementPosition.right + tipWidth > viewportPosition.width) {
              placement = placement.replace('right', 'left');
            }
            tipElement.removeClass(originalPlacement).addClass(placement);
          }
          var tipPosition = getCalculatedOffset(placement, elementPosition, tipWidth, tipHeight);
          applyPlacement(tipPosition, placement);
        };
        $tooltip.$onKeyUp = function(evt) {
          if (evt.which === 27 && $tooltip.$isShown) {
            $tooltip.hide();
            evt.stopPropagation();
          }
        };
        $tooltip.$onFocusKeyUp = function(evt) {
          if (evt.which === 27) {
            element[0].blur();
            evt.stopPropagation();
          }
        };
        $tooltip.$onFocusElementMouseDown = function(evt) {
          if (options.mouseDownPreventDefault) {
            evt.preventDefault();
          }
          if (options.mouseDownStopPropagation) {
            evt.stopPropagation();
          }
          if ($tooltip.$isShown) {
            element[0].blur();
          } else {
            element[0].focus();
          }
        };
        function bindTriggerEvents() {
          var triggers = options.trigger.split(' ');
          angular.forEach(triggers, function(trigger) {
            if (trigger === 'click' || trigger === 'contextmenu') {
              element.on(trigger, $tooltip.toggle);
            } else if (trigger !== 'manual') {
              element.on(trigger === 'hover' ? 'mouseenter' : 'focus', $tooltip.enter);
              element.on(trigger === 'hover' ? 'mouseleave' : 'blur', $tooltip.leave);
              if (nodeName === 'button' && trigger !== 'hover') {
                element.on(isTouch ? 'touchstart' : 'mousedown', $tooltip.$onFocusElementMouseDown);
              }
            }
          });
        }
        function unbindTriggerEvents() {
          var triggers = options.trigger.split(' ');
          for (var i = triggers.length; i--; ) {
            var trigger = triggers[i];
            if (trigger === 'click' || trigger === 'contextmenu') {
              element.off(trigger, $tooltip.toggle);
            } else if (trigger !== 'manual') {
              element.off(trigger === 'hover' ? 'mouseenter' : 'focus', $tooltip.enter);
              element.off(trigger === 'hover' ? 'mouseleave' : 'blur', $tooltip.leave);
              if (nodeName === 'button' && trigger !== 'hover') {
                element.off(isTouch ? 'touchstart' : 'mousedown', $tooltip.$onFocusElementMouseDown);
              }
            }
          }
        }
        function bindKeyboardEvents() {
          if (options.trigger !== 'focus') {
            tipElement.on('keyup', $tooltip.$onKeyUp);
          } else {
            element.on('keyup', $tooltip.$onFocusKeyUp);
          }
        }
        function unbindKeyboardEvents() {
          if (options.trigger !== 'focus') {
            tipElement.off('keyup', $tooltip.$onKeyUp);
          } else {
            element.off('keyup', $tooltip.$onFocusKeyUp);
          }
        }
        var _autoCloseEventsBinded = false;
        function bindAutoCloseEvents() {
          $timeout(function() {
            tipElement.on('click', stopEventPropagation);
            $body.on('click', $tooltip.hide);
            _autoCloseEventsBinded = true;
          }, 0, false);
        }
        function unbindAutoCloseEvents() {
          if (_autoCloseEventsBinded) {
            tipElement.off('click', stopEventPropagation);
            $body.off('click', $tooltip.hide);
            _autoCloseEventsBinded = false;
          }
        }
        function stopEventPropagation(event) {
          event.stopPropagation();
        }
        function getPosition($element) {
          $element = $element || (options.target || element);
          var el = $element[0];
          var isBody = el.tagName === 'BODY';
          var elRect = el.getBoundingClientRect();
          var rect = {};
          for (var p in elRect) {
            rect[p] = elRect[p];
          }
          if (rect.width === null) {
            rect = angular.extend({}, rect, {
              width: elRect.right - elRect.left,
              height: elRect.bottom - elRect.top
            });
          }
          var elOffset = isBody ? {
            top: 0,
            left: 0
          } : dimensions.offset(el);
          var scroll = {
            scroll: isBody ? document.documentElement.scrollTop || document.body.scrollTop : $element.prop('scrollTop') || 0
          };
          var outerDims = isBody ? {
            width: document.documentElement.clientWidth,
            height: $window.innerHeight
          } : null;
          return angular.extend({}, rect, scroll, outerDims, elOffset);
        }
        function getCalculatedOffset(placement, position, actualWidth, actualHeight) {
          var offset;
          var split = placement.split('-');
          switch (split[0]) {
           case 'right':
            offset = {
              top: position.top + position.height / 2 - actualHeight / 2,
              left: position.left + position.width
            };
            break;

           case 'bottom':
            offset = {
              top: position.top + position.height,
              left: position.left + position.width / 2 - actualWidth / 2
            };
            break;

           case 'left':
            offset = {
              top: position.top + position.height / 2 - actualHeight / 2,
              left: position.left - actualWidth
            };
            break;

           default:
            offset = {
              top: position.top - actualHeight,
              left: position.left + position.width / 2 - actualWidth / 2
            };
            break;
          }
          if (!split[1]) {
            return offset;
          }
          if (split[0] === 'top' || split[0] === 'bottom') {
            switch (split[1]) {
             case 'left':
              offset.left = position.left;
              break;

             case 'right':
              offset.left = position.left + position.width - actualWidth;
              break;

             default:
              break;
            }
          } else if (split[0] === 'left' || split[0] === 'right') {
            switch (split[1]) {
             case 'top':
              offset.top = position.top - actualHeight + position.height;
              break;

             case 'bottom':
              offset.top = position.top;
              break;

             default:
              break;
            }
          }
          return offset;
        }
        function applyPlacement(offset, placement) {
          var tip = tipElement[0];
          var width = tip.offsetWidth;
          var height = tip.offsetHeight;
          var marginTop = parseInt(dimensions.css(tip, 'margin-top'), 10);
          var marginLeft = parseInt(dimensions.css(tip, 'margin-left'), 10);
          if (isNaN(marginTop)) marginTop = 0;
          if (isNaN(marginLeft)) marginLeft = 0;
          offset.top = offset.top + marginTop;
          offset.left = offset.left + marginLeft;
          dimensions.setOffset(tip, angular.extend({
            using: function(props) {
              tipElement.css({
                top: Math.round(props.top) + 'px',
                left: Math.round(props.left) + 'px',
                right: ''
              });
            }
          }, offset), 0);
          var actualWidth = tip.offsetWidth;
          var actualHeight = tip.offsetHeight;
          if (placement === 'top' && actualHeight !== height) {
            offset.top = offset.top + height - actualHeight;
          }
          if (/top-left|top-right|bottom-left|bottom-right/.test(placement)) return;
          var delta = getViewportAdjustedDelta(placement, offset, actualWidth, actualHeight);
          if (delta.left) {
            offset.left += delta.left;
          } else {
            offset.top += delta.top;
          }
          dimensions.setOffset(tip, offset);
          if (/top|right|bottom|left/.test(placement)) {
            var isVertical = /top|bottom/.test(placement);
            var arrowDelta = isVertical ? delta.left * 2 - width + actualWidth : delta.top * 2 - height + actualHeight;
            var arrowOffsetPosition = isVertical ? 'offsetWidth' : 'offsetHeight';
            replaceArrow(arrowDelta, tip[arrowOffsetPosition], isVertical);
          }
        }
        function getViewportAdjustedDelta(placement, position, actualWidth, actualHeight) {
          var delta = {
            top: 0,
            left: 0
          };
          if (!$tooltip.$viewport) return delta;
          var viewportPadding = options.viewport && options.viewport.padding || 0;
          var viewportDimensions = getPosition($tooltip.$viewport);
          if (/right|left/.test(placement)) {
            var topEdgeOffset = position.top - viewportPadding - viewportDimensions.scroll;
            var bottomEdgeOffset = position.top + viewportPadding - viewportDimensions.scroll + actualHeight;
            if (topEdgeOffset < viewportDimensions.top) {
              delta.top = viewportDimensions.top - topEdgeOffset;
            } else if (bottomEdgeOffset > viewportDimensions.top + viewportDimensions.height) {
              delta.top = viewportDimensions.top + viewportDimensions.height - bottomEdgeOffset;
            }
          } else {
            var leftEdgeOffset = position.left - viewportPadding;
            var rightEdgeOffset = position.left + viewportPadding + actualWidth;
            if (leftEdgeOffset < viewportDimensions.left) {
              delta.left = viewportDimensions.left - leftEdgeOffset;
            } else if (rightEdgeOffset > viewportDimensions.right) {
              delta.left = viewportDimensions.left + viewportDimensions.width - rightEdgeOffset;
            }
          }
          return delta;
        }
        function replaceArrow(delta, dimension, isHorizontal) {
          var $arrow = findElement('.tooltip-arrow, .arrow', tipElement[0]);
          $arrow.css(isHorizontal ? 'left' : 'top', 50 * (1 - delta / dimension) + '%').css(isHorizontal ? 'top' : 'left', '');
        }
        function destroyTipElement() {
          clearTimeout(timeout);
          if ($tooltip.$isShown && tipElement !== null) {
            if (options.autoClose) {
              unbindAutoCloseEvents();
            }
            if (options.keyboard) {
              unbindKeyboardEvents();
            }
          }
          if (tipScope) {
            tipScope.$destroy();
            tipScope = null;
          }
          if (tipElement) {
            tipElement.remove();
            tipElement = $tooltip.$element = null;
          }
        }
        return $tooltip;
      }
      function safeDigest(scope) {
        scope.$$phase || scope.$root && scope.$root.$$phase || scope.$digest();
      }
      function findElement(query, element) {
        return angular.element((element || document).querySelectorAll(query));
      }
      return TooltipFactory;
    } ];
  }).directive('bsTooltip', [ '$window', '$location', '$sce', '$parse', '$tooltip', '$$rAF', function($window, $location, $sce, $parse, $tooltip, $$rAF) {
    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr, transclusion) {
        var tooltip;
        var options = {
          scope: scope
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'titleTemplate', 'placement', 'container', 'delay', 'trigger', 'html', 'animation', 'backdropAnimation', 'type', 'customClass', 'id' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'html', 'container' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) {
            options[key] = false;
          }
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        var dataTarget = element.attr('data-target');
        if (angular.isDefined(dataTarget)) {
          if (falseValueRegExp.test(dataTarget)) {
            options.target = false;
          } else {
            options.target = dataTarget;
          }
        }
        if (!scope.hasOwnProperty('title')) {
          scope.title = '';
        }
        attr.$observe('title', function(newValue) {
          if (angular.isDefined(newValue) || !scope.hasOwnProperty('title')) {
            var oldValue = scope.title;
            scope.title = $sce.trustAsHtml(newValue);
            if (angular.isDefined(oldValue)) {
              $$rAF(function() {
                if (tooltip) tooltip.$applyPlacement();
              });
            }
          }
        });
        attr.$observe('disabled', function(newValue) {
          if (newValue && tooltip.$isShown) {
            tooltip.hide();
          }
        });
        if (attr.bsTooltip) {
          scope.$watch(attr.bsTooltip, function(newValue, oldValue) {
            if (angular.isObject(newValue)) {
              angular.extend(scope, newValue);
            } else {
              scope.title = newValue;
            }
            if (angular.isDefined(oldValue)) {
              $$rAF(function() {
                if (tooltip) tooltip.$applyPlacement();
              });
            }
          }, true);
        }
        if (attr.bsShow) {
          scope.$watch(attr.bsShow, function(newValue, oldValue) {
            if (!tooltip || !angular.isDefined(newValue)) return;
            if (angular.isString(newValue)) newValue = !!newValue.match(/true|,?(tooltip),?/i);
            if (newValue === true) {
              tooltip.show();
            } else {
              tooltip.hide();
            }
          });
        }
        if (attr.bsEnabled) {
          scope.$watch(attr.bsEnabled, function(newValue, oldValue) {
            if (!tooltip || !angular.isDefined(newValue)) return;
            if (angular.isString(newValue)) newValue = !!newValue.match(/true|1|,?(tooltip),?/i);
            if (newValue === false) {
              tooltip.setEnabled(false);
            } else {
              tooltip.setEnabled(true);
            }
          });
        }
        if (attr.viewport) {
          scope.$watch(attr.viewport, function(newValue) {
            if (!tooltip || !angular.isDefined(newValue)) return;
            tooltip.setViewport(newValue);
          });
        }
        tooltip = $tooltip(element, options);
        scope.$on('$destroy', function() {
          if (tooltip) tooltip.destroy();
          options = null;
          tooltip = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.timepicker', [ 'mgcrea.ngStrap.helpers.dateParser', 'mgcrea.ngStrap.helpers.dateFormatter', 'mgcrea.ngStrap.tooltip' ]).provider('$timepicker', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      defaultDate: 'auto',
      prefixClass: 'timepicker',
      placement: 'bottom-left',
      templateUrl: 'timepicker/timepicker.tpl.html',
      trigger: 'focus',
      container: false,
      keyboard: true,
      html: false,
      delay: 0,
      useNative: true,
      timeType: 'date',
      timeFormat: 'shortTime',
      timezone: null,
      modelTimeFormat: null,
      autoclose: false,
      minTime: -Infinity,
      maxTime: +Infinity,
      length: 5,
      hourStep: 1,
      minuteStep: 5,
      secondStep: 5,
      roundDisplay: false,
      iconUp: 'glyphicon glyphicon-chevron-up',
      iconDown: 'glyphicon glyphicon-chevron-down',
      arrowBehavior: 'pager'
    };
    this.$get = [ '$window', '$document', '$rootScope', '$sce', '$dateFormatter', '$tooltip', '$timeout', function($window, $document, $rootScope, $sce, $dateFormatter, $tooltip, $timeout) {
      var isNative = /(ip[ao]d|iphone|android)/gi.test($window.navigator.userAgent);
      var isTouch = 'createTouch' in $window.document && isNative;
      if (!defaults.lang) {
        defaults.lang = $dateFormatter.getDefaultLocale();
      }
      function timepickerFactory(element, controller, config) {
        var $timepicker = $tooltip(element, angular.extend({}, defaults, config));
        var parentScope = config.scope;
        var options = $timepicker.$options;
        var scope = $timepicker.$scope;
        var lang = options.lang;
        var formatDate = function(date, format, timezone) {
          return $dateFormatter.formatDate(date, format, lang, timezone);
        };
        function floorMinutes(time) {
          var coeff = 1e3 * 60 * options.minuteStep;
          return new Date(Math.floor(time.getTime() / coeff) * coeff);
        }
        var selectedIndex = 0;
        var defaultDate = options.roundDisplay ? floorMinutes(new Date()) : new Date();
        var startDate = controller.$dateValue || defaultDate;
        var viewDate = {
          hour: startDate.getHours(),
          meridian: startDate.getHours() < 12,
          minute: startDate.getMinutes(),
          second: startDate.getSeconds(),
          millisecond: startDate.getMilliseconds()
        };
        var format = $dateFormatter.getDatetimeFormat(options.timeFormat, lang);
        var hoursFormat = $dateFormatter.hoursFormat(format);
        var timeSeparator = $dateFormatter.timeSeparator(format);
        var minutesFormat = $dateFormatter.minutesFormat(format);
        var secondsFormat = $dateFormatter.secondsFormat(format);
        var showSeconds = $dateFormatter.showSeconds(format);
        var showAM = $dateFormatter.showAM(format);
        scope.$iconUp = options.iconUp;
        scope.$iconDown = options.iconDown;
        scope.$select = function(date, index) {
          $timepicker.select(date, index);
        };
        scope.$moveIndex = function(value, index) {
          $timepicker.$moveIndex(value, index);
        };
        scope.$switchMeridian = function(date) {
          $timepicker.switchMeridian(date);
        };
        $timepicker.update = function(date) {
          if (angular.isDate(date) && !isNaN(date.getTime())) {
            $timepicker.$date = date;
            angular.extend(viewDate, {
              hour: date.getHours(),
              minute: date.getMinutes(),
              second: date.getSeconds(),
              millisecond: date.getMilliseconds()
            });
            $timepicker.$build();
          } else if (!$timepicker.$isBuilt) {
            $timepicker.$build();
          }
        };
        $timepicker.select = function(date, index, keep) {
          if (!controller.$dateValue || isNaN(controller.$dateValue.getTime())) {
            controller.$dateValue = options.defaultDate === 'today' ? new Date() : new Date(1970, 0, 1);
          }
          if (!angular.isDate(date)) date = new Date(date);
          if (index === 0) controller.$dateValue.setHours(date.getHours()); else if (index === 1) controller.$dateValue.setMinutes(date.getMinutes()); else if (index === 2) controller.$dateValue.setSeconds(date.getSeconds());
          controller.$setViewValue(angular.copy(controller.$dateValue));
          controller.$render();
          if (options.autoclose && !keep) {
            $timeout(function() {
              $timepicker.hide(true);
            });
          }
        };
        $timepicker.switchMeridian = function(date) {
          if (!controller.$dateValue || isNaN(controller.$dateValue.getTime())) {
            return;
          }
          var hours = (date || controller.$dateValue).getHours();
          controller.$dateValue.setHours(hours < 12 ? hours + 12 : hours - 12);
          controller.$setViewValue(angular.copy(controller.$dateValue));
          controller.$render();
        };
        $timepicker.$build = function() {
          var i;
          var midIndex = scope.midIndex = parseInt(options.length / 2, 10);
          var hours = [];
          var hour;
          for (i = 0; i < options.length; i++) {
            hour = new Date(1970, 0, 1, viewDate.hour - (midIndex - i) * options.hourStep);
            hours.push({
              date: hour,
              label: formatDate(hour, hoursFormat),
              selected: $timepicker.$date && $timepicker.$isSelected(hour, 0),
              disabled: $timepicker.$isDisabled(hour, 0)
            });
          }
          var minutes = [];
          var minute;
          for (i = 0; i < options.length; i++) {
            minute = new Date(1970, 0, 1, 0, viewDate.minute - (midIndex - i) * options.minuteStep);
            minutes.push({
              date: minute,
              label: formatDate(minute, minutesFormat),
              selected: $timepicker.$date && $timepicker.$isSelected(minute, 1),
              disabled: $timepicker.$isDisabled(minute, 1)
            });
          }
          var seconds = [];
          var second;
          for (i = 0; i < options.length; i++) {
            second = new Date(1970, 0, 1, 0, 0, viewDate.second - (midIndex - i) * options.secondStep);
            seconds.push({
              date: second,
              label: formatDate(second, secondsFormat),
              selected: $timepicker.$date && $timepicker.$isSelected(second, 2),
              disabled: $timepicker.$isDisabled(second, 2)
            });
          }
          var rows = [];
          for (i = 0; i < options.length; i++) {
            if (showSeconds) {
              rows.push([ hours[i], minutes[i], seconds[i] ]);
            } else {
              rows.push([ hours[i], minutes[i] ]);
            }
          }
          scope.rows = rows;
          scope.showSeconds = showSeconds;
          scope.showAM = showAM;
          scope.isAM = ($timepicker.$date || hours[midIndex].date).getHours() < 12;
          scope.timeSeparator = timeSeparator;
          $timepicker.$isBuilt = true;
        };
        $timepicker.$isSelected = function(date, index) {
          if (!$timepicker.$date) return false; else if (index === 0) {
            return date.getHours() === $timepicker.$date.getHours();
          } else if (index === 1) {
            return date.getMinutes() === $timepicker.$date.getMinutes();
          } else if (index === 2) {
            return date.getSeconds() === $timepicker.$date.getSeconds();
          }
        };
        $timepicker.$isDisabled = function(date, index) {
          var selectedTime;
          if (index === 0) {
            selectedTime = date.getTime() + viewDate.minute * 6e4 + viewDate.second * 1e3;
          } else if (index === 1) {
            selectedTime = date.getTime() + viewDate.hour * 36e5 + viewDate.second * 1e3;
          } else if (index === 2) {
            selectedTime = date.getTime() + viewDate.hour * 36e5 + viewDate.minute * 6e4;
          }
          return selectedTime < options.minTime * 1 || selectedTime > options.maxTime * 1;
        };
        scope.$arrowAction = function(value, index) {
          if (options.arrowBehavior === 'picker') {
            $timepicker.$setTimeByStep(value, index);
          } else {
            $timepicker.$moveIndex(value, index);
          }
        };
        $timepicker.$setTimeByStep = function(value, index) {
          var newDate = new Date($timepicker.$date || startDate);
          var hours = newDate.getHours();
          var minutes = newDate.getMinutes();
          var seconds = newDate.getSeconds();
          if (index === 0) {
            newDate.setHours(hours - parseInt(options.hourStep, 10) * value);
          } else if (index === 1) {
            newDate.setMinutes(minutes - parseInt(options.minuteStep, 10) * value);
          } else if (index === 2) {
            newDate.setSeconds(seconds - parseInt(options.secondStep, 10) * value);
          }
          $timepicker.select(newDate, index, true);
        };
        $timepicker.$moveIndex = function(value, index) {
          var targetDate;
          if (index === 0) {
            targetDate = new Date(1970, 0, 1, viewDate.hour + value * options.length, viewDate.minute, viewDate.second);
            angular.extend(viewDate, {
              hour: targetDate.getHours()
            });
          } else if (index === 1) {
            targetDate = new Date(1970, 0, 1, viewDate.hour, viewDate.minute + value * options.length * options.minuteStep, viewDate.second);
            angular.extend(viewDate, {
              minute: targetDate.getMinutes()
            });
          } else if (index === 2) {
            targetDate = new Date(1970, 0, 1, viewDate.hour, viewDate.minute, viewDate.second + value * options.length * options.secondStep);
            angular.extend(viewDate, {
              second: targetDate.getSeconds()
            });
          }
          $timepicker.$build();
        };
        $timepicker.$onMouseDown = function(evt) {
          if (evt.target.nodeName.toLowerCase() !== 'input') evt.preventDefault();
          evt.stopPropagation();
          if (isTouch) {
            var targetEl = angular.element(evt.target);
            if (targetEl[0].nodeName.toLowerCase() !== 'button') {
              targetEl = targetEl.parent();
            }
            targetEl.triggerHandler('click');
          }
        };
        $timepicker.$onKeyDown = function(evt) {
          if (!/(38|37|39|40|13)/.test(evt.keyCode) || evt.shiftKey || evt.altKey) return;
          evt.preventDefault();
          evt.stopPropagation();
          if (evt.keyCode === 13) {
            $timepicker.hide(true);
            return;
          }
          var newDate = new Date($timepicker.$date);
          var hours = newDate.getHours();
          var hoursLength = formatDate(newDate, hoursFormat).length;
          var minutes = newDate.getMinutes();
          var minutesLength = formatDate(newDate, minutesFormat).length;
          var seconds = newDate.getSeconds();
          var secondsLength = formatDate(newDate, secondsFormat).length;
          var sepLength = 1;
          var lateralMove = /(37|39)/.test(evt.keyCode);
          var count = 2 + showSeconds * 1 + showAM * 1;
          if (lateralMove) {
            if (evt.keyCode === 37) selectedIndex = selectedIndex < 1 ? count - 1 : selectedIndex - 1; else if (evt.keyCode === 39) selectedIndex = selectedIndex < count - 1 ? selectedIndex + 1 : 0;
          }
          var selectRange = [ 0, hoursLength ];
          var incr = 0;
          if (evt.keyCode === 38) incr = -1;
          if (evt.keyCode === 40) incr = +1;
          var isSeconds = selectedIndex === 2 && showSeconds;
          var isMeridian = selectedIndex === 2 && !showSeconds || selectedIndex === 3 && showSeconds;
          if (selectedIndex === 0) {
            newDate.setHours(hours + incr * parseInt(options.hourStep, 10));
            hoursLength = formatDate(newDate, hoursFormat).length;
            selectRange = [ 0, hoursLength ];
          } else if (selectedIndex === 1) {
            newDate.setMinutes(minutes + incr * parseInt(options.minuteStep, 10));
            minutesLength = formatDate(newDate, minutesFormat).length;
            selectRange = [ hoursLength + sepLength, minutesLength ];
          } else if (isSeconds) {
            newDate.setSeconds(seconds + incr * parseInt(options.secondStep, 10));
            secondsLength = formatDate(newDate, secondsFormat).length;
            selectRange = [ hoursLength + sepLength + minutesLength + sepLength, secondsLength ];
          } else if (isMeridian) {
            if (!lateralMove) $timepicker.switchMeridian();
            selectRange = [ hoursLength + sepLength + minutesLength + sepLength + (secondsLength + sepLength) * showSeconds, 2 ];
          }
          $timepicker.select(newDate, selectedIndex, true);
          createSelection(selectRange[0], selectRange[1]);
          parentScope.$digest();
        };
        function createSelection(start, length) {
          var end = start + length;
          if (element[0].createTextRange) {
            var selRange = element[0].createTextRange();
            selRange.collapse(true);
            selRange.moveStart('character', start);
            selRange.moveEnd('character', end);
            selRange.select();
          } else if (element[0].setSelectionRange) {
            element[0].setSelectionRange(start, end);
          } else if (angular.isUndefined(element[0].selectionStart)) {
            element[0].selectionStart = start;
            element[0].selectionEnd = end;
          }
        }
        function focusElement() {
          element[0].focus();
        }
        var _init = $timepicker.init;
        $timepicker.init = function() {
          if (isNative && options.useNative) {
            element.prop('type', 'time');
            element.css('-webkit-appearance', 'textfield');
            return;
          } else if (isTouch) {
            element.prop('type', 'text');
            element.attr('readonly', 'true');
            element.on('click', focusElement);
          }
          _init();
        };
        var _destroy = $timepicker.destroy;
        $timepicker.destroy = function() {
          if (isNative && options.useNative) {
            element.off('click', focusElement);
          }
          _destroy();
        };
        var _show = $timepicker.show;
        $timepicker.show = function() {
          if (!isTouch && element.attr('readonly') || element.attr('disabled')) return;
          _show();
          $timeout(function() {
            if ($timepicker.$element) $timepicker.$element.on(isTouch ? 'touchstart' : 'mousedown', $timepicker.$onMouseDown);
            if (options.keyboard) {
              if (element) element.on('keydown', $timepicker.$onKeyDown);
            }
          }, 0, false);
        };
        var _hide = $timepicker.hide;
        $timepicker.hide = function(blur) {
          if (!$timepicker.$isShown) return;
          if ($timepicker.$element) $timepicker.$element.off(isTouch ? 'touchstart' : 'mousedown', $timepicker.$onMouseDown);
          if (options.keyboard) {
            if (element) element.off('keydown', $timepicker.$onKeyDown);
          }
          _hide(blur);
        };
        return $timepicker;
      }
      timepickerFactory.defaults = defaults;
      return timepickerFactory;
    } ];
  }).directive('bsTimepicker', [ '$window', '$parse', '$q', '$dateFormatter', '$dateParser', '$timepicker', function($window, $parse, $q, $dateFormatter, $dateParser, $timepicker) {
    var defaults = $timepicker.defaults;
    var isNative = /(ip[ao]d|iphone|android)/gi.test($window.navigator.userAgent);
    return {
      restrict: 'EAC',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        var options = {
          scope: scope
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'placement', 'container', 'delay', 'trigger', 'keyboard', 'html', 'animation', 'autoclose', 'timeType', 'timeFormat', 'timezone', 'modelTimeFormat', 'useNative', 'hourStep', 'minuteStep', 'secondStep', 'length', 'arrowBehavior', 'iconUp', 'iconDown', 'roundDisplay', 'id', 'prefixClass', 'prefixEvent', 'defaultDate' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'html', 'container', 'autoclose', 'useNative', 'roundDisplay' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) {
            options[key] = false;
          }
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        if (isNative && (options.useNative || defaults.useNative)) options.timeFormat = 'HH:mm';
        var timepicker = $timepicker(element, controller, options);
        options = timepicker.$options;
        var lang = options.lang;
        var formatDate = function(date, format, timezone) {
          return $dateFormatter.formatDate(date, format, lang, timezone);
        };
        if (attr.bsShow) {
          scope.$watch(attr.bsShow, function(newValue, oldValue) {
            if (!timepicker || !angular.isDefined(newValue)) return;
            if (angular.isString(newValue)) newValue = !!newValue.match(/true|,?(timepicker),?/i);
            if (newValue === true) {
              timepicker.show();
            } else {
              timepicker.hide();
            }
          });
        }
        var dateParser = $dateParser({
          format: options.timeFormat,
          lang: lang
        });
        angular.forEach([ 'minTime', 'maxTime' ], function(key) {
          if (angular.isDefined(attr[key])) {
            attr.$observe(key, function(newValue) {
              timepicker.$options[key] = dateParser.getTimeForAttribute(key, newValue);
              if (!isNaN(timepicker.$options[key])) timepicker.$build();
              validateAgainstMinMaxTime(controller.$dateValue);
            });
          }
        });
        scope.$watch(attr.ngModel, function(newValue, oldValue) {
          timepicker.update(controller.$dateValue);
        }, true);
        function validateAgainstMinMaxTime(parsedTime) {
          if (!angular.isDate(parsedTime)) return;
          var isMinValid = isNaN(options.minTime) || new Date(parsedTime.getTime()).setFullYear(1970, 0, 1) >= options.minTime;
          var isMaxValid = isNaN(options.maxTime) || new Date(parsedTime.getTime()).setFullYear(1970, 0, 1) <= options.maxTime;
          var isValid = isMinValid && isMaxValid;
          controller.$setValidity('date', isValid);
          controller.$setValidity('min', isMinValid);
          controller.$setValidity('max', isMaxValid);
          if (!isValid) {
            return;
          }
          controller.$dateValue = parsedTime;
        }
        controller.$parsers.unshift(function(viewValue) {
          var date;
          if (!viewValue) {
            controller.$setValidity('date', true);
            return null;
          }
          var parsedTime = angular.isDate(viewValue) ? viewValue : dateParser.parse(viewValue, controller.$dateValue);
          if (!parsedTime || isNaN(parsedTime.getTime())) {
            controller.$setValidity('date', false);
            return undefined;
          }
          validateAgainstMinMaxTime(parsedTime);
          if (options.timeType === 'string') {
            date = dateParser.timezoneOffsetAdjust(parsedTime, options.timezone, true);
            return formatDate(date, options.modelTimeFormat || options.timeFormat);
          }
          date = dateParser.timezoneOffsetAdjust(controller.$dateValue, options.timezone, true);
          if (options.timeType === 'number') {
            return date.getTime();
          } else if (options.timeType === 'unix') {
            return date.getTime() / 1e3;
          } else if (options.timeType === 'iso') {
            return date.toISOString();
          }
          return new Date(date);
        });
        controller.$formatters.push(function(modelValue) {
          var date;
          if (angular.isUndefined(modelValue) || modelValue === null) {
            date = NaN;
          } else if (angular.isDate(modelValue)) {
            date = modelValue;
          } else if (options.timeType === 'string') {
            date = dateParser.parse(modelValue, null, options.modelTimeFormat);
          } else if (options.timeType === 'unix') {
            date = new Date(modelValue * 1e3);
          } else {
            date = new Date(modelValue);
          }
          controller.$dateValue = dateParser.timezoneOffsetAdjust(date, options.timezone);
          return getTimeFormattedString();
        });
        controller.$render = function() {
          element.val(getTimeFormattedString());
        };
        function getTimeFormattedString() {
          return !controller.$dateValue || isNaN(controller.$dateValue.getTime()) ? '' : formatDate(controller.$dateValue, options.timeFormat);
        }
        scope.$on('$destroy', function() {
          if (timepicker) timepicker.destroy();
          options = null;
          timepicker = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.tab', []).provider('$tab', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      template: 'tab/tab.tpl.html',
      navClass: 'nav-tabs',
      activeClass: 'active'
    };
    var controller = this.controller = function($scope, $element, $attrs) {
      var self = this;
      self.$options = angular.copy(defaults);
      angular.forEach([ 'animation', 'navClass', 'activeClass' ], function(key) {
        if (angular.isDefined($attrs[key])) self.$options[key] = $attrs[key];
      });
      $scope.$navClass = self.$options.navClass;
      $scope.$activeClass = self.$options.activeClass;
      self.$panes = $scope.$panes = [];
      self.$activePaneChangeListeners = self.$viewChangeListeners = [];
      self.$push = function(pane) {
        if (angular.isUndefined(self.$panes.$active)) {
          $scope.$setActive(pane.name || 0);
        }
        self.$panes.push(pane);
      };
      self.$remove = function(pane) {
        var index = self.$panes.indexOf(pane);
        var active = self.$panes.$active;
        var activeIndex;
        if (angular.isString(active)) {
          activeIndex = self.$panes.map(function(pane) {
            return pane.name;
          }).indexOf(active);
        } else {
          activeIndex = self.$panes.$active;
        }
        self.$panes.splice(index, 1);
        if (index < activeIndex) {
          activeIndex--;
        } else if (index === activeIndex && activeIndex === self.$panes.length) {
          activeIndex--;
        }
        if (activeIndex >= 0 && activeIndex < self.$panes.length) {
          self.$setActive(self.$panes[activeIndex].name || activeIndex);
        } else {
          self.$setActive();
        }
      };
      self.$setActive = $scope.$setActive = function(value) {
        self.$panes.$active = value;
        self.$activePaneChangeListeners.forEach(function(fn) {
          fn();
        });
      };
      self.$isActive = $scope.$isActive = function($pane, $index) {
        return self.$panes.$active === $pane.name || self.$panes.$active === $index;
      };
    };
    this.$get = function() {
      var $tab = {};
      $tab.defaults = defaults;
      $tab.controller = controller;
      return $tab;
    };
  }).directive('bsTabs', [ '$window', '$animate', '$tab', '$parse', function($window, $animate, $tab, $parse) {
    var defaults = $tab.defaults;
    return {
      require: [ '?ngModel', 'bsTabs' ],
      transclude: true,
      scope: true,
      controller: [ '$scope', '$element', '$attrs', $tab.controller ],
      templateUrl: function(element, attr) {
        return attr.template || defaults.template;
      },
      link: function postLink(scope, element, attrs, controllers) {
        var ngModelCtrl = controllers[0];
        var bsTabsCtrl = controllers[1];
        if (ngModelCtrl) {
          bsTabsCtrl.$activePaneChangeListeners.push(function() {
            ngModelCtrl.$setViewValue(bsTabsCtrl.$panes.$active);
          });
          ngModelCtrl.$formatters.push(function(modelValue) {
            bsTabsCtrl.$setActive(modelValue);
            return modelValue;
          });
        }
        if (attrs.bsActivePane) {
          var parsedBsActivePane = $parse(attrs.bsActivePane);
          bsTabsCtrl.$activePaneChangeListeners.push(function() {
            parsedBsActivePane.assign(scope, bsTabsCtrl.$panes.$active);
          });
          scope.$watch(attrs.bsActivePane, function(newValue, oldValue) {
            bsTabsCtrl.$setActive(newValue);
          }, true);
        }
      }
    };
  } ]).directive('bsPane', [ '$window', '$animate', '$sce', function($window, $animate, $sce) {
    return {
      require: [ '^?ngModel', '^bsTabs' ],
      scope: true,
      link: function postLink(scope, element, attrs, controllers) {
        var bsTabsCtrl = controllers[1];
        element.addClass('tab-pane');
        attrs.$observe('title', function(newValue, oldValue) {
          scope.title = $sce.trustAsHtml(newValue);
        });
        scope.name = attrs.name;
        if (bsTabsCtrl.$options.animation) {
          element.addClass(bsTabsCtrl.$options.animation);
        }
        attrs.$observe('disabled', function(newValue, oldValue) {
          scope.disabled = scope.$eval(newValue);
        });
        bsTabsCtrl.$push(scope);
        scope.$on('$destroy', function() {
          bsTabsCtrl.$remove(scope);
        });
        function render() {
          var index = bsTabsCtrl.$panes.indexOf(scope);
          $animate[bsTabsCtrl.$isActive(scope, index) ? 'addClass' : 'removeClass'](element, bsTabsCtrl.$options.activeClass);
        }
        bsTabsCtrl.$activePaneChangeListeners.push(function() {
          render();
        });
        render();
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.select', [ 'mgcrea.ngStrap.tooltip', 'mgcrea.ngStrap.helpers.parseOptions' ]).provider('$select', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      prefixClass: 'select',
      prefixEvent: '$select',
      placement: 'bottom-left',
      templateUrl: 'select/select.tpl.html',
      trigger: 'focus',
      container: false,
      keyboard: true,
      html: false,
      delay: 0,
      multiple: false,
      allNoneButtons: false,
      sort: true,
      caretHtml: '&nbsp;<span class="caret"></span>',
      placeholder: 'Choose among the following...',
      allText: 'All',
      noneText: 'None',
      maxLength: 3,
      maxLengthHtml: 'selected',
      iconCheckmark: 'glyphicon glyphicon-ok',
      toggle: false
    };
    this.$get = [ '$window', '$document', '$rootScope', '$tooltip', '$timeout', function($window, $document, $rootScope, $tooltip, $timeout) {
      var isNative = /(ip[ao]d|iphone|android)/gi.test($window.navigator.userAgent);
      var isTouch = 'createTouch' in $window.document && isNative;
      function SelectFactory(element, controller, config) {
        var $select = {};
        var options = angular.extend({}, defaults, config);
        $select = $tooltip(element, options);
        var scope = $select.$scope;
        scope.$matches = [];
        if (options.multiple) {
          scope.$activeIndex = [];
        } else {
          scope.$activeIndex = -1;
        }
        scope.$isMultiple = options.multiple;
        scope.$showAllNoneButtons = options.allNoneButtons && options.multiple;
        scope.$iconCheckmark = options.iconCheckmark;
        scope.$allText = options.allText;
        scope.$noneText = options.noneText;
        scope.$activate = function(index) {
          scope.$$postDigest(function() {
            $select.activate(index);
          });
        };
        scope.$select = function(index, evt) {
          scope.$$postDigest(function() {
            $select.select(index);
          });
        };
        scope.$isVisible = function() {
          return $select.$isVisible();
        };
        scope.$isActive = function(index) {
          return $select.$isActive(index);
        };
        scope.$selectAll = function() {
          for (var i = 0; i < scope.$matches.length; i++) {
            if (!scope.$isActive(i)) {
              scope.$select(i);
            }
          }
        };
        scope.$selectNone = function() {
          for (var i = 0; i < scope.$matches.length; i++) {
            if (scope.$isActive(i)) {
              scope.$select(i);
            }
          }
        };
        $select.update = function(matches) {
          scope.$matches = matches;
          $select.$updateActiveIndex();
        };
        $select.activate = function(index) {
          if (options.multiple) {
            if ($select.$isActive(index)) {
              scope.$activeIndex.splice(scope.$activeIndex.indexOf(index), 1);
            } else {
              scope.$activeIndex.push(index);
            }
            if (options.sort) scope.$activeIndex.sort(function(a, b) {
              return a - b;
            });
          } else {
            scope.$activeIndex = index;
          }
          return scope.$activeIndex;
        };
        $select.select = function(index) {
          if (angular.isUndefined(index) || index < 0 || index >= scope.$matches.length) {
            return;
          }
          var value = scope.$matches[index].value;
          scope.$apply(function() {
            $select.activate(index);
            if (options.multiple) {
              controller.$setViewValue(scope.$activeIndex.map(function(index) {
                if (angular.isUndefined(scope.$matches[index])) {
                  return null;
                }
                return scope.$matches[index].value;
              }));
            } else {
              if (options.toggle) {
                controller.$setViewValue(value === controller.$modelValue ? undefined : value);
              } else {
                controller.$setViewValue(value);
              }
              $select.hide();
            }
          });
          scope.$emit(options.prefixEvent + '.select', value, index, $select);
          if (angular.isDefined(options.onSelect) && angular.isFunction(options.onSelect)) {
            options.onSelect(value, index, $select);
          }
        };
        $select.$updateActiveIndex = function() {
          if (options.multiple) {
            if (angular.isArray(controller.$modelValue)) {
              scope.$activeIndex = controller.$modelValue.map(function(value) {
                return $select.$getIndex(value);
              });
            } else {
              scope.$activeIndex = [];
            }
          } else {
            if (angular.isDefined(controller.$modelValue) && scope.$matches.length) {
              scope.$activeIndex = $select.$getIndex(controller.$modelValue);
            } else {
              scope.$activeIndex = -1;
            }
          }
        };
        $select.$isVisible = function() {
          if (!options.minLength || !controller) {
            return scope.$matches.length;
          }
          return scope.$matches.length && controller.$viewValue.length >= options.minLength;
        };
        $select.$isActive = function(index) {
          if (options.multiple) {
            return scope.$activeIndex.indexOf(index) !== -1;
          }
          return scope.$activeIndex === index;
        };
        $select.$getIndex = function(value) {
          var index;
          for (index = scope.$matches.length; index--; ) {
            if (angular.equals(scope.$matches[index].value, value)) break;
          }
          return index;
        };
        $select.$onMouseDown = function(evt) {
          evt.preventDefault();
          evt.stopPropagation();
          if (isTouch) {
            var targetEl = angular.element(evt.target);
            var anchor;
            if (evt.target.nodeName !== 'A') {
              var anchorCandidate = targetEl.parent();
              while (!anchor && anchorCandidate.length > 0) {
                if (anchorCandidate[0].nodeName === 'A') {
                  anchor = anchorCandidate;
                }
                anchorCandidate = anchorCandidate.parent();
              }
            }
            if (anchor) {
              angular.element(anchor).triggerHandler('click');
            } else {
              targetEl.triggerHandler('click');
            }
          }
        };
        $select.$onKeyDown = function(evt) {
          if (!/(9|13|38|40)/.test(evt.keyCode)) return;
          if (evt.keyCode !== 9) {
            evt.preventDefault();
            evt.stopPropagation();
          }
          if (options.multiple && evt.keyCode === 9) {
            return $select.hide();
          }
          if (!options.multiple && (evt.keyCode === 13 || evt.keyCode === 9)) {
            return $select.select(scope.$activeIndex);
          }
          if (!options.multiple) {
            if (evt.keyCode === 38 && scope.$activeIndex > 0) scope.$activeIndex--; else if (evt.keyCode === 38 && scope.$activeIndex < 0) scope.$activeIndex = scope.$matches.length - 1; else if (evt.keyCode === 40 && scope.$activeIndex < scope.$matches.length - 1) scope.$activeIndex++; else if (angular.isUndefined(scope.$activeIndex)) scope.$activeIndex = 0;
            scope.$digest();
          }
        };
        $select.$isIE = function() {
          var ua = $window.navigator.userAgent;
          return ua.indexOf('MSIE ') > 0 || ua.indexOf('Trident/') > 0 || ua.indexOf('Edge/') > 0;
        };
        $select.$selectScrollFix = function(e) {
          if ($document[0].activeElement.tagName === 'UL') {
            e.preventDefault();
            e.stopImmediatePropagation();
            e.target.focus();
          }
        };
        var _show = $select.show;
        $select.show = function() {
          _show();
          if (options.multiple) {
            $select.$element.addClass('select-multiple');
          }
          $timeout(function() {
            $select.$element.on(isTouch ? 'touchstart' : 'mousedown', $select.$onMouseDown);
            if (options.keyboard) {
              element.on('keydown', $select.$onKeyDown);
            }
          }, 0, false);
        };
        var _hide = $select.hide;
        $select.hide = function() {
          if (!options.multiple && angular.isUndefined(controller.$modelValue)) {
            scope.$activeIndex = -1;
          }
          $select.$element.off(isTouch ? 'touchstart' : 'mousedown', $select.$onMouseDown);
          if (options.keyboard) {
            element.off('keydown', $select.$onKeyDown);
          }
          _hide(true);
        };
        return $select;
      }
      SelectFactory.defaults = defaults;
      return SelectFactory;
    } ];
  }).directive('bsSelect', [ '$window', '$parse', '$q', '$select', '$parseOptions', function($window, $parse, $q, $select, $parseOptions) {
    var defaults = $select.defaults;
    return {
      restrict: 'EAC',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        var options = {
          scope: scope,
          placeholder: defaults.placeholder
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'placement', 'container', 'delay', 'trigger', 'keyboard', 'html', 'animation', 'placeholder', 'allNoneButtons', 'maxLength', 'maxLengthHtml', 'allText', 'noneText', 'iconCheckmark', 'autoClose', 'id', 'sort', 'caretHtml', 'prefixClass', 'prefixEvent', 'toggle' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'html', 'container', 'allNoneButtons', 'sort' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) {
            options[key] = false;
          }
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide', 'onSelect' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        var dataMultiple = element.attr('data-multiple');
        if (angular.isDefined(dataMultiple)) {
          if (falseValueRegExp.test(dataMultiple)) {
            options.multiple = false;
          } else {
            options.multiple = dataMultiple;
          }
        }
        if (element[0].nodeName.toLowerCase() === 'select') {
          var inputEl = element;
          inputEl.css('display', 'none');
          element = angular.element('<button type="button" class="btn btn-default"></button>');
          inputEl.after(element);
        }
        var parsedOptions = $parseOptions(attr.bsOptions);
        var select = $select(element, controller, options);
        if (select.$isIE()) {
          element[0].addEventListener('blur', select.$selectScrollFix);
        }
        var watchedOptions = parsedOptions.$match[7].replace(/\|.+/, '').trim();
        scope.$watch(watchedOptions, function(newValue, oldValue) {
          parsedOptions.valuesFn(scope, controller).then(function(values) {
            select.update(values);
            controller.$render();
          });
        }, true);
        scope.$watch(attr.ngModel, function(newValue, oldValue) {
          select.$updateActiveIndex();
          controller.$render();
        }, true);
        controller.$render = function() {
          var selected;
          var index;
          if (options.multiple && angular.isArray(controller.$modelValue)) {
            selected = controller.$modelValue.map(function(value) {
              index = select.$getIndex(value);
              return index !== -1 ? select.$scope.$matches[index].label : false;
            }).filter(angular.isDefined);
            if (selected.length > (options.maxLength || defaults.maxLength)) {
              selected = selected.length + ' ' + (options.maxLengthHtml || defaults.maxLengthHtml);
            } else {
              selected = selected.join(', ');
            }
          } else {
            index = select.$getIndex(controller.$modelValue);
            selected = index !== -1 ? select.$scope.$matches[index].label : false;
          }
          element.html((selected || options.placeholder) + (options.caretHtml || defaults.caretHtml));
        };
        if (options.multiple) {
          controller.$isEmpty = function(value) {
            return !value || value.length === 0;
          };
        }
        scope.$on('$destroy', function() {
          if (select) select.destroy();
          options = null;
          select = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.scrollspy', [ 'mgcrea.ngStrap.helpers.debounce', 'mgcrea.ngStrap.helpers.dimensions' ]).provider('$scrollspy', function() {
    var spies = this.$$spies = {};
    var defaults = this.defaults = {
      debounce: 150,
      throttle: 100,
      offset: 100
    };
    this.$get = [ '$window', '$document', '$rootScope', 'dimensions', 'debounce', 'throttle', function($window, $document, $rootScope, dimensions, debounce, throttle) {
      var windowEl = angular.element($window);
      var docEl = angular.element($document.prop('documentElement'));
      var bodyEl = angular.element($window.document.body);
      function nodeName(element, name) {
        return element[0].nodeName && element[0].nodeName.toLowerCase() === name.toLowerCase();
      }
      function ScrollSpyFactory(config) {
        var options = angular.extend({}, defaults, config);
        if (!options.element) options.element = bodyEl;
        var isWindowSpy = nodeName(options.element, 'body');
        var scrollEl = isWindowSpy ? windowEl : options.element;
        var scrollId = isWindowSpy ? 'window' : options.id;
        if (spies[scrollId]) {
          spies[scrollId].$$count++;
          return spies[scrollId];
        }
        var $scrollspy = {};
        var unbindViewContentLoaded;
        var unbindIncludeContentLoaded;
        var trackedElements = $scrollspy.$trackedElements = [];
        var sortedElements = [];
        var activeTarget;
        var debouncedCheckPosition;
        var throttledCheckPosition;
        var debouncedCheckOffsets;
        var viewportHeight;
        var scrollTop;
        $scrollspy.init = function() {
          this.$$count = 1;
          debouncedCheckPosition = debounce(this.checkPosition, options.debounce);
          throttledCheckPosition = throttle(this.checkPosition, options.throttle);
          scrollEl.on('click', this.checkPositionWithEventLoop);
          windowEl.on('resize', debouncedCheckPosition);
          scrollEl.on('scroll', throttledCheckPosition);
          debouncedCheckOffsets = debounce(this.checkOffsets, options.debounce);
          unbindViewContentLoaded = $rootScope.$on('$viewContentLoaded', debouncedCheckOffsets);
          unbindIncludeContentLoaded = $rootScope.$on('$includeContentLoaded', debouncedCheckOffsets);
          debouncedCheckOffsets();
          if (scrollId) {
            spies[scrollId] = $scrollspy;
          }
        };
        $scrollspy.destroy = function() {
          this.$$count--;
          if (this.$$count > 0) {
            return;
          }
          scrollEl.off('click', this.checkPositionWithEventLoop);
          windowEl.off('resize', debouncedCheckPosition);
          scrollEl.off('scroll', throttledCheckPosition);
          unbindViewContentLoaded();
          unbindIncludeContentLoaded();
          if (scrollId) {
            delete spies[scrollId];
          }
        };
        $scrollspy.checkPosition = function() {
          if (!sortedElements.length) return;
          scrollTop = (isWindowSpy ? $window.pageYOffset : scrollEl.prop('scrollTop')) || 0;
          viewportHeight = Math.max($window.innerHeight, docEl.prop('clientHeight'));
          if (scrollTop < sortedElements[0].offsetTop && activeTarget !== sortedElements[0].target) {
            return $scrollspy.$activateElement(sortedElements[0]);
          }
          for (var i = sortedElements.length; i--; ) {
            if (angular.isUndefined(sortedElements[i].offsetTop) || sortedElements[i].offsetTop === null) continue;
            if (activeTarget === sortedElements[i].target) continue;
            if (scrollTop < sortedElements[i].offsetTop) continue;
            if (sortedElements[i + 1] && scrollTop > sortedElements[i + 1].offsetTop) continue;
            return $scrollspy.$activateElement(sortedElements[i]);
          }
        };
        $scrollspy.checkPositionWithEventLoop = function() {
          setTimeout($scrollspy.checkPosition, 1);
        };
        $scrollspy.$activateElement = function(element) {
          if (activeTarget) {
            var activeElement = $scrollspy.$getTrackedElement(activeTarget);
            if (activeElement) {
              activeElement.source.removeClass('active');
              if (nodeName(activeElement.source, 'li') && nodeName(activeElement.source.parent().parent(), 'li')) {
                activeElement.source.parent().parent().removeClass('active');
              }
            }
          }
          activeTarget = element.target;
          element.source.addClass('active');
          if (nodeName(element.source, 'li') && nodeName(element.source.parent().parent(), 'li')) {
            element.source.parent().parent().addClass('active');
          }
        };
        $scrollspy.$getTrackedElement = function(target) {
          return trackedElements.filter(function(obj) {
            return obj.target === target;
          })[0];
        };
        $scrollspy.checkOffsets = function() {
          angular.forEach(trackedElements, function(trackedElement) {
            var targetElement = document.querySelector(trackedElement.target);
            trackedElement.offsetTop = targetElement ? dimensions.offset(targetElement).top : null;
            if (options.offset && trackedElement.offsetTop !== null) trackedElement.offsetTop -= options.offset * 1;
          });
          sortedElements = trackedElements.filter(function(el) {
            return el.offsetTop !== null;
          }).sort(function(a, b) {
            return a.offsetTop - b.offsetTop;
          });
          debouncedCheckPosition();
        };
        $scrollspy.trackElement = function(target, source) {
          trackedElements.push({
            target: target,
            source: source
          });
        };
        $scrollspy.untrackElement = function(target, source) {
          var toDelete;
          for (var i = trackedElements.length; i--; ) {
            if (trackedElements[i].target === target && trackedElements[i].source === source) {
              toDelete = i;
              break;
            }
          }
          trackedElements.splice(toDelete, 1);
        };
        $scrollspy.activate = function(i) {
          trackedElements[i].addClass('active');
        };
        $scrollspy.init();
        return $scrollspy;
      }
      return ScrollSpyFactory;
    } ];
  }).directive('bsScrollspy', [ '$rootScope', 'debounce', 'dimensions', '$scrollspy', function($rootScope, debounce, dimensions, $scrollspy) {
    return {
      restrict: 'EAC',
      link: function postLink(scope, element, attr) {
        var options = {
          scope: scope
        };
        angular.forEach([ 'offset', 'target' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var scrollspy = $scrollspy(options);
        scrollspy.trackElement(options.target, element);
        scope.$on('$destroy', function() {
          if (scrollspy) {
            scrollspy.untrackElement(options.target, element);
            scrollspy.destroy();
          }
          options = null;
          scrollspy = null;
        });
      }
    };
  } ]).directive('bsScrollspyList', [ '$rootScope', 'debounce', 'dimensions', '$scrollspy', function($rootScope, debounce, dimensions, $scrollspy) {
    return {
      restrict: 'A',
      compile: function postLink(element, attr) {
        var children = element[0].querySelectorAll('li > a[href]');
        angular.forEach(children, function(child) {
          var childEl = angular.element(child);
          childEl.parent().attr('bs-scrollspy', '').attr('data-target', childEl.attr('href'));
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.popover', [ 'mgcrea.ngStrap.tooltip' ]).provider('$popover', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      customClass: '',
      container: false,
      target: false,
      placement: 'right',
      templateUrl: 'popover/popover.tpl.html',
      contentTemplate: false,
      trigger: 'click',
      keyboard: true,
      html: false,
      title: '',
      content: '',
      delay: 0,
      autoClose: false
    };
    this.$get = [ '$tooltip', function($tooltip) {
      function PopoverFactory(element, config) {
        var options = angular.extend({}, defaults, config);
        var $popover = $tooltip(element, options);
        if (options.content) {
          $popover.$scope.content = options.content;
        }
        return $popover;
      }
      return PopoverFactory;
    } ];
  }).directive('bsPopover', [ '$window', '$sce', '$popover', function($window, $sce, $popover) {
    var requestAnimationFrame = $window.requestAnimationFrame || $window.setTimeout;
    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr) {
        var popover;
        var options = {
          scope: scope
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'contentTemplate', 'placement', 'container', 'delay', 'trigger', 'html', 'animation', 'customClass', 'autoClose', 'id', 'prefixClass', 'prefixEvent', 'bsEnabled' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'html', 'container', 'autoClose' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) options[key] = false;
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        var dataTarget = element.attr('data-target');
        if (angular.isDefined(dataTarget)) {
          if (falseValueRegExp.test(dataTarget)) {
            options.target = false;
          } else {
            options.target = dataTarget;
          }
        }
        angular.forEach([ 'title', 'content' ], function(key) {
          if (attr[key]) {
            attr.$observe(key, function(newValue, oldValue) {
              scope[key] = $sce.trustAsHtml(newValue);
              if (angular.isDefined(oldValue)) {
                requestAnimationFrame(function() {
                  if (popover) popover.$applyPlacement();
                });
              }
            });
          }
        });
        if (attr.bsPopover) {
          scope.$watch(attr.bsPopover, function(newValue, oldValue) {
            if (angular.isObject(newValue)) {
              angular.extend(scope, newValue);
            } else {
              scope.content = newValue;
            }
            if (angular.isDefined(oldValue)) {
              requestAnimationFrame(function() {
                if (popover) popover.$applyPlacement();
              });
            }
          }, true);
        }
        if (attr.bsShow) {
          scope.$watch(attr.bsShow, function(newValue, oldValue) {
            if (!popover || !angular.isDefined(newValue)) return;
            if (angular.isString(newValue)) newValue = !!newValue.match(/true|,?(popover),?/i);
            if (newValue === true) {
              popover.show();
            } else {
              popover.hide();
            }
          });
        }
        if (attr.bsEnabled) {
          scope.$watch(attr.bsEnabled, function(newValue) {
            if (!popover || !angular.isDefined(newValue)) return;
            if (angular.isString(newValue)) newValue = !!newValue.match(/true|1|,?(popover),?/i);
            if (newValue === false) {
              popover.setEnabled(false);
            } else {
              popover.setEnabled(true);
            }
          });
        }
        if (attr.viewport) {
          scope.$watch(attr.viewport, function(newValue) {
            if (!popover || !angular.isDefined(newValue)) return;
            popover.setViewport(newValue);
          });
        }
        popover = $popover(element, options);
        scope.$on('$destroy', function() {
          if (popover) popover.destroy();
          options = null;
          popover = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.navbar', []).provider('$navbar', function() {
    var defaults = this.defaults = {
      activeClass: 'active',
      routeAttr: 'data-match-route',
      strict: false
    };
    this.$get = function() {
      return {
        defaults: defaults
      };
    };
  }).directive('bsNavbar', [ '$window', '$location', '$navbar', function($window, $location, $navbar) {
    var defaults = $navbar.defaults;
    return {
      restrict: 'A',
      link: function postLink(scope, element, attr, controller) {
        var options = angular.copy(defaults);
        angular.forEach(Object.keys(defaults), function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        scope.$watch(function() {
          return $location.path();
        }, function(newValue, oldValue) {
          var liElements = element[0].querySelectorAll('li[' + options.routeAttr + ']');
          angular.forEach(liElements, function(li) {
            var liElement = angular.element(li);
            var pattern = liElement.attr(options.routeAttr).replace('/', '\\/');
            if (options.strict) {
              pattern = '^' + pattern + '$';
            }
            var regexp = new RegExp(pattern, 'i');
            if (regexp.test(newValue)) {
              liElement.addClass(options.activeClass);
            } else {
              liElement.removeClass(options.activeClass);
            }
          });
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.modal', [ 'mgcrea.ngStrap.core', 'mgcrea.ngStrap.helpers.dimensions' ]).provider('$modal', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      backdropAnimation: 'am-fade',
      customClass: '',
      prefixClass: 'modal',
      prefixEvent: 'modal',
      placement: 'top',
      templateUrl: 'modal/modal.tpl.html',
      template: '',
      contentTemplate: false,
      container: false,
      element: null,
      backdrop: true,
      keyboard: true,
      html: false,
      show: true,
      size: null,
      zIndex: null
    };
    this.$get = [ '$window', '$rootScope', '$bsCompiler', '$animate', '$timeout', '$sce', 'dimensions', function($window, $rootScope, $bsCompiler, $animate, $timeout, $sce, dimensions) {
      var forEach = angular.forEach;
      var requestAnimationFrame = $window.requestAnimationFrame || $window.setTimeout;
      var bodyElement = angular.element($window.document.body);
      var backdropCount = 0;
      var dialogBaseZindex = 1050;
      var backdropBaseZindex = 1040;
      var validSizes = {
        lg: 'modal-lg',
        sm: 'modal-sm'
      };
      function ModalFactory(config) {
        var $modal = {};
        var options = $modal.$options = angular.extend({}, defaults, config);
        var promise = $modal.$promise = $bsCompiler.compile(options);
        var scope = $modal.$scope = options.scope && options.scope.$new() || $rootScope.$new();
        if (!options.element && !options.container) {
          options.container = 'body';
        }
        if (options.zIndex) {
          dialogBaseZindex = parseInt(options.zIndex, 10);
          backdropBaseZindex = dialogBaseZindex - 10;
        }
        $modal.$id = options.id || options.element && options.element.attr('id') || '';
        forEach([ 'title', 'content' ], function(key) {
          if (options[key]) scope[key] = $sce.trustAsHtml(options[key]);
        });
        scope.$hide = function() {
          scope.$$postDigest(function() {
            $modal.hide();
          });
        };
        scope.$show = function() {
          scope.$$postDigest(function() {
            $modal.show();
          });
        };
        scope.$toggle = function() {
          scope.$$postDigest(function() {
            $modal.toggle();
          });
        };
        $modal.$isShown = scope.$isShown = false;
        var compileData;
        var modalElement;
        var modalScope;
        var backdropElement = angular.element('<div class="' + options.prefixClass + '-backdrop"/>');
        backdropElement.css({
          position: 'fixed',
          top: '0px',
          left: '0px',
          bottom: '0px',
          right: '0px'
        });
        promise.then(function(data) {
          compileData = data;
          $modal.init();
        });
        $modal.init = function() {
          if (options.show) {
            scope.$$postDigest(function() {
              $modal.show();
            });
          }
        };
        $modal.destroy = function() {
          destroyModalElement();
          if (backdropElement) {
            backdropElement.remove();
            backdropElement = null;
          }
          scope.$destroy();
        };
        $modal.show = function() {
          if ($modal.$isShown) return;
          var parent;
          var after;
          if (angular.isElement(options.container)) {
            parent = options.container;
            after = options.container[0].lastChild ? angular.element(options.container[0].lastChild) : null;
          } else {
            if (options.container) {
              parent = findElement(options.container);
              after = parent[0] && parent[0].lastChild ? angular.element(parent[0].lastChild) : null;
            } else {
              parent = null;
              after = options.element;
            }
          }
          if (modalElement) destroyModalElement();
          modalScope = $modal.$scope.$new();
          modalElement = $modal.$element = compileData.link(modalScope, function(clonedElement, scope) {});
          if (options.backdrop) {
            modalElement.css({
              'z-index': dialogBaseZindex + backdropCount * 20
            });
            backdropElement.css({
              'z-index': backdropBaseZindex + backdropCount * 20
            });
            backdropCount++;
          }
          if (scope.$emit(options.prefixEvent + '.show.before', $modal).defaultPrevented) {
            return;
          }
          if (angular.isDefined(options.onBeforeShow) && angular.isFunction(options.onBeforeShow)) {
            options.onBeforeShow($modal);
          }
          modalElement.css({
            display: 'block'
          }).addClass(options.placement);
          if (options.customClass) {
            modalElement.addClass(options.customClass);
          }
          if (options.size && validSizes[options.size]) {
            angular.element(findElement('.modal-dialog', modalElement[0])).addClass(validSizes[options.size]);
          }
          if (options.animation) {
            if (options.backdrop) {
              backdropElement.addClass(options.backdropAnimation);
            }
            modalElement.addClass(options.animation);
          }
          if (options.backdrop) {
            $animate.enter(backdropElement, bodyElement, null);
          }
          if (angular.version.minor <= 2) {
            $animate.enter(modalElement, parent, after, enterAnimateCallback);
          } else {
            $animate.enter(modalElement, parent, after).then(enterAnimateCallback);
          }
          $modal.$isShown = scope.$isShown = true;
          safeDigest(scope);
          var el = modalElement[0];
          requestAnimationFrame(function() {
            el.focus();
          });
          bodyElement.addClass(options.prefixClass + '-open');
          if (options.animation) {
            bodyElement.addClass(options.prefixClass + '-with-' + options.animation);
          }
          bindBackdropEvents();
          bindKeyboardEvents();
        };
        function enterAnimateCallback() {
          scope.$emit(options.prefixEvent + '.show', $modal);
          if (angular.isDefined(options.onShow) && angular.isFunction(options.onShow)) {
            options.onShow($modal);
          }
        }
        $modal.hide = function() {
          if (!$modal.$isShown) return;
          if (scope.$emit(options.prefixEvent + '.hide.before', $modal).defaultPrevented) {
            return;
          }
          if (angular.isDefined(options.onBeforeHide) && angular.isFunction(options.onBeforeHide)) {
            options.onBeforeHide($modal);
          }
          if (angular.version.minor <= 2) {
            $animate.leave(modalElement, leaveAnimateCallback);
          } else {
            $animate.leave(modalElement).then(leaveAnimateCallback);
          }
          if (options.backdrop) {
            backdropCount--;
            $animate.leave(backdropElement);
          }
          $modal.$isShown = scope.$isShown = false;
          safeDigest(scope);
          unbindBackdropEvents();
          unbindKeyboardEvents();
        };
        function leaveAnimateCallback() {
          scope.$emit(options.prefixEvent + '.hide', $modal);
          if (angular.isDefined(options.onHide) && angular.isFunction(options.onHide)) {
            options.onHide($modal);
          }
          if (findElement('.modal').length <= 0) {
            bodyElement.removeClass(options.prefixClass + '-open');
          }
          if (options.animation) {
            bodyElement.removeClass(options.prefixClass + '-with-' + options.animation);
          }
        }
        $modal.toggle = function() {
          if ($modal.$isShown) {
            $modal.hide();
          } else {
            $modal.show();
          }
        };
        $modal.focus = function() {
          modalElement[0].focus();
        };
        $modal.$onKeyUp = function(evt) {
          if (evt.which === 27 && $modal.$isShown) {
            $modal.hide();
            evt.stopPropagation();
          }
        };
        function bindBackdropEvents() {
          if (options.backdrop) {
            modalElement.on('click', hideOnBackdropClick);
            backdropElement.on('click', hideOnBackdropClick);
            backdropElement.on('wheel', preventEventDefault);
          }
        }
        function unbindBackdropEvents() {
          if (options.backdrop) {
            modalElement.off('click', hideOnBackdropClick);
            backdropElement.off('click', hideOnBackdropClick);
            backdropElement.off('wheel', preventEventDefault);
          }
        }
        function bindKeyboardEvents() {
          if (options.keyboard) {
            modalElement.on('keyup', $modal.$onKeyUp);
          }
        }
        function unbindKeyboardEvents() {
          if (options.keyboard) {
            modalElement.off('keyup', $modal.$onKeyUp);
          }
        }
        function hideOnBackdropClick(evt) {
          if (evt.target !== evt.currentTarget) return;
          if (options.backdrop === 'static') {
            $modal.focus();
          } else {
            $modal.hide();
          }
        }
        function preventEventDefault(evt) {
          evt.preventDefault();
        }
        function destroyModalElement() {
          if ($modal.$isShown && modalElement !== null) {
            unbindBackdropEvents();
            unbindKeyboardEvents();
          }
          if (modalScope) {
            modalScope.$destroy();
            modalScope = null;
          }
          if (modalElement) {
            modalElement.remove();
            modalElement = $modal.$element = null;
          }
        }
        return $modal;
      }
      function safeDigest(scope) {
        scope.$$phase || scope.$root && scope.$root.$$phase || scope.$digest();
      }
      function findElement(query, element) {
        return angular.element((element || document).querySelectorAll(query));
      }
      return ModalFactory;
    } ];
  }).directive('bsModal', [ '$window', '$sce', '$parse', '$modal', function($window, $sce, $parse, $modal) {
    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr, transclusion) {
        var options = {
          scope: scope,
          element: element,
          show: false
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'contentTemplate', 'placement', 'backdrop', 'keyboard', 'html', 'container', 'animation', 'backdropAnimation', 'id', 'prefixEvent', 'prefixClass', 'customClass', 'modalClass', 'size', 'zIndex' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        if (options.modalClass) {
          options.customClass = options.modalClass;
        }
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'backdrop', 'keyboard', 'html', 'container' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) options[key] = false;
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        angular.forEach([ 'title', 'content' ], function(key) {
          if (attr[key]) {
            attr.$observe(key, function(newValue, oldValue) {
              scope[key] = $sce.trustAsHtml(newValue);
            });
          }
        });
        if (attr.bsModal) {
          scope.$watch(attr.bsModal, function(newValue, oldValue) {
            if (angular.isObject(newValue)) {
              angular.extend(scope, newValue);
            } else {
              scope.content = newValue;
            }
          }, true);
        }
        var modal = $modal(options);
        element.on(attr.trigger || 'click', modal.toggle);
        scope.$on('$destroy', function() {
          if (modal) modal.destroy();
          options = null;
          modal = null;
        });
      }
    };
  } ]);
  if (angular.version.minor < 3 && angular.version.dot < 14) {
    angular.module('ng').factory('$$rAF', [ '$window', '$timeout', function($window, $timeout) {
      var requestAnimationFrame = $window.requestAnimationFrame || $window.webkitRequestAnimationFrame || $window.mozRequestAnimationFrame;
      var cancelAnimationFrame = $window.cancelAnimationFrame || $window.webkitCancelAnimationFrame || $window.mozCancelAnimationFrame || $window.webkitCancelRequestAnimationFrame;
      var rafSupported = !!requestAnimationFrame;
      var raf = rafSupported ? function(fn) {
        var id = requestAnimationFrame(fn);
        return function() {
          cancelAnimationFrame(id);
        };
      } : function(fn) {
        var timer = $timeout(fn, 16.66, false);
        return function() {
          $timeout.cancel(timer);
        };
      };
      raf.supported = rafSupported;
      return raf;
    } ]);
  }
  angular.module('mgcrea.ngStrap.helpers.parseOptions', []).provider('$parseOptions', function() {
    var defaults = this.defaults = {
      regexp: /^\s*(.*?)(?:\s+as\s+(.*?))?(?:\s+group\s+by\s+(.*))?\s+for\s+(?:([\$\w][\$\w]*)|(?:\(\s*([\$\w][\$\w]*)\s*,\s*([\$\w][\$\w]*)\s*\)))\s+in\s+(.*?)(?:\s+track\s+by\s+(.*?))?$/
    };
    this.$get = [ '$parse', '$q', function($parse, $q) {
      function ParseOptionsFactory(attr, config) {
        var $parseOptions = {};
        var options = angular.extend({}, defaults, config);
        $parseOptions.$values = [];
        var match;
        var displayFn;
        var valueName;
        var keyName;
        var groupByFn;
        var valueFn;
        var valuesFn;
        $parseOptions.init = function() {
          $parseOptions.$match = match = attr.match(options.regexp);
          displayFn = $parse(match[2] || match[1]);
          valueName = match[4] || match[6];
          keyName = match[5];
          groupByFn = $parse(match[3] || '');
          valueFn = $parse(match[2] ? match[1] : valueName);
          valuesFn = $parse(match[7]);
        };
        $parseOptions.valuesFn = function(scope, controller) {
          return $q.when(valuesFn(scope, controller)).then(function(values) {
            if (!angular.isArray(values)) {
              values = [];
            }
            $parseOptions.$values = values.length ? parseValues(values, scope) : [];
            return $parseOptions.$values;
          });
        };
        $parseOptions.displayValue = function(modelValue) {
          var scope = {};
          scope[valueName] = modelValue;
          return displayFn(scope);
        };
        function parseValues(values, scope) {
          return values.map(function(match, index) {
            var locals = {};
            var label;
            var value;
            locals[valueName] = match;
            label = displayFn(scope, locals);
            value = valueFn(scope, locals);
            return {
              label: label,
              value: value,
              index: index
            };
          });
        }
        $parseOptions.init();
        return $parseOptions;
      }
      return ParseOptionsFactory;
    } ];
  });
  angular.module('mgcrea.ngStrap.helpers.dimensions', []).factory('dimensions', function() {
    var fn = {};
    var nodeName = fn.nodeName = function(element, name) {
      return element.nodeName && element.nodeName.toLowerCase() === name.toLowerCase();
    };
    fn.css = function(element, prop, extra) {
      var value;
      if (element.currentStyle) {
        value = element.currentStyle[prop];
      } else if (window.getComputedStyle) {
        value = window.getComputedStyle(element)[prop];
      } else {
        value = element.style[prop];
      }
      return extra === true ? parseFloat(value) || 0 : value;
    };
    fn.offset = function(element) {
      var boxRect = element.getBoundingClientRect();
      var docElement = element.ownerDocument;
      return {
        width: boxRect.width || element.offsetWidth,
        height: boxRect.height || element.offsetHeight,
        top: boxRect.top + (window.pageYOffset || docElement.documentElement.scrollTop) - (docElement.documentElement.clientTop || 0),
        left: boxRect.left + (window.pageXOffset || docElement.documentElement.scrollLeft) - (docElement.documentElement.clientLeft || 0)
      };
    };
    fn.setOffset = function(element, options, i) {
      var curPosition;
      var curLeft;
      var curCSSTop;
      var curTop;
      var curOffset;
      var curCSSLeft;
      var calculatePosition;
      var position = fn.css(element, 'position');
      var curElem = angular.element(element);
      var props = {};
      if (position === 'static') {
        element.style.position = 'relative';
      }
      curOffset = fn.offset(element);
      curCSSTop = fn.css(element, 'top');
      curCSSLeft = fn.css(element, 'left');
      calculatePosition = (position === 'absolute' || position === 'fixed') && (curCSSTop + curCSSLeft).indexOf('auto') > -1;
      if (calculatePosition) {
        curPosition = fn.position(element);
        curTop = curPosition.top;
        curLeft = curPosition.left;
      } else {
        curTop = parseFloat(curCSSTop) || 0;
        curLeft = parseFloat(curCSSLeft) || 0;
      }
      if (angular.isFunction(options)) {
        options = options.call(element, i, curOffset);
      }
      if (options.top !== null) {
        props.top = options.top - curOffset.top + curTop;
      }
      if (options.left !== null) {
        props.left = options.left - curOffset.left + curLeft;
      }
      if ('using' in options) {
        options.using.call(curElem, props);
      } else {
        curElem.css({
          top: props.top + 'px',
          left: props.left + 'px'
        });
      }
    };
    fn.position = function(element) {
      var offsetParentRect = {
        top: 0,
        left: 0
      };
      var offsetParentEl;
      var offset;
      if (fn.css(element, 'position') === 'fixed') {
        offset = element.getBoundingClientRect();
      } else {
        offsetParentEl = offsetParentElement(element);
        offset = fn.offset(element);
        if (!nodeName(offsetParentEl, 'html')) {
          offsetParentRect = fn.offset(offsetParentEl);
        }
        offsetParentRect.top += fn.css(offsetParentEl, 'borderTopWidth', true);
        offsetParentRect.left += fn.css(offsetParentEl, 'borderLeftWidth', true);
      }
      return {
        width: element.offsetWidth,
        height: element.offsetHeight,
        top: offset.top - offsetParentRect.top - fn.css(element, 'marginTop', true),
        left: offset.left - offsetParentRect.left - fn.css(element, 'marginLeft', true)
      };
    };
    function offsetParentElement(element) {
      var docElement = element.ownerDocument;
      var offsetParent = element.offsetParent || docElement;
      if (nodeName(offsetParent, '#document')) return docElement.documentElement;
      while (offsetParent && !nodeName(offsetParent, 'html') && fn.css(offsetParent, 'position') === 'static') {
        offsetParent = offsetParent.offsetParent;
      }
      return offsetParent || docElement.documentElement;
    }
    fn.height = function(element, outer) {
      var value = element.offsetHeight;
      if (outer) {
        value += fn.css(element, 'marginTop', true) + fn.css(element, 'marginBottom', true);
      } else {
        value -= fn.css(element, 'paddingTop', true) + fn.css(element, 'paddingBottom', true) + fn.css(element, 'borderTopWidth', true) + fn.css(element, 'borderBottomWidth', true);
      }
      return value;
    };
    fn.width = function(element, outer) {
      var value = element.offsetWidth;
      if (outer) {
        value += fn.css(element, 'marginLeft', true) + fn.css(element, 'marginRight', true);
      } else {
        value -= fn.css(element, 'paddingLeft', true) + fn.css(element, 'paddingRight', true) + fn.css(element, 'borderLeftWidth', true) + fn.css(element, 'borderRightWidth', true);
      }
      return value;
    };
    return fn;
  });
  angular.module('mgcrea.ngStrap.helpers.debounce', []).factory('debounce', [ '$timeout', function($timeout) {
    return function(func, wait, immediate) {
      var timeout = null;
      return function() {
        var context = this;
        var args = arguments;
        var callNow = immediate && !timeout;
        if (timeout) {
          $timeout.cancel(timeout);
        }
        timeout = $timeout(function later() {
          timeout = null;
          if (!immediate) {
            func.apply(context, args);
          }
        }, wait, false);
        if (callNow) {
          func.apply(context, args);
        }
        return timeout;
      };
    };
  } ]).factory('throttle', [ '$timeout', function($timeout) {
    return function(func, wait, options) {
      var timeout = null;
      if (!options) options = {};
      return function() {
        var context = this;
        var args = arguments;
        if (!timeout) {
          if (options.leading !== false) {
            func.apply(context, args);
          }
          timeout = $timeout(function later() {
            timeout = null;
            if (options.trailing !== false) {
              func.apply(context, args);
            }
          }, wait, false);
        }
      };
    };
  } ]);
  angular.module('mgcrea.ngStrap.helpers.dateParser', []).provider('$dateParser', [ '$localeProvider', function($localeProvider) {
    function ParseDate() {
      this.year = 1970;
      this.month = 0;
      this.day = 1;
      this.hours = 0;
      this.minutes = 0;
      this.seconds = 0;
      this.milliseconds = 0;
    }
    ParseDate.prototype.setMilliseconds = function(value) {
      this.milliseconds = value;
    };
    ParseDate.prototype.setSeconds = function(value) {
      this.seconds = value;
    };
    ParseDate.prototype.setMinutes = function(value) {
      this.minutes = value;
    };
    ParseDate.prototype.setHours = function(value) {
      this.hours = value;
    };
    ParseDate.prototype.getHours = function() {
      return this.hours;
    };
    ParseDate.prototype.setDate = function(value) {
      this.day = value;
    };
    ParseDate.prototype.setMonth = function(value) {
      this.month = value;
    };
    ParseDate.prototype.setFullYear = function(value) {
      this.year = value;
    };
    ParseDate.prototype.fromDate = function(value) {
      this.year = value.getFullYear();
      this.month = value.getMonth();
      this.day = value.getDate();
      this.hours = value.getHours();
      this.minutes = value.getMinutes();
      this.seconds = value.getSeconds();
      this.milliseconds = value.getMilliseconds();
      return this;
    };
    ParseDate.prototype.toDate = function() {
      return new Date(this.year, this.month, this.day, this.hours, this.minutes, this.seconds, this.milliseconds);
    };
    var proto = ParseDate.prototype;
    function noop() {}
    function isNumeric(n) {
      return !isNaN(parseFloat(n)) && isFinite(n);
    }
    function indexOfCaseInsensitive(array, value) {
      var len = array.length;
      var str = value.toString().toLowerCase();
      for (var i = 0; i < len; i++) {
        if (array[i].toLowerCase() === str) {
          return i;
        }
      }
      return -1;
    }
    var defaults = this.defaults = {
      format: 'shortDate',
      strict: false
    };
    this.$get = [ '$locale', 'dateFilter', function($locale, dateFilter) {
      var DateParserFactory = function(config) {
        var options = angular.extend({}, defaults, config);
        var $dateParser = {};
        var regExpMap = {
          sss: '[0-9]{3}',
          ss: '[0-5][0-9]',
          s: options.strict ? '[1-5]?[0-9]' : '[0-9]|[0-5][0-9]',
          mm: '[0-5][0-9]',
          m: options.strict ? '[1-5]?[0-9]' : '[0-9]|[0-5][0-9]',
          HH: '[01][0-9]|2[0-3]',
          H: options.strict ? '1?[0-9]|2[0-3]' : '[01]?[0-9]|2[0-3]',
          hh: '[0][1-9]|[1][012]',
          h: options.strict ? '[1-9]|1[012]' : '0?[1-9]|1[012]',
          a: 'AM|PM',
          EEEE: $locale.DATETIME_FORMATS.DAY.join('|'),
          EEE: $locale.DATETIME_FORMATS.SHORTDAY.join('|'),
          dd: '0[1-9]|[12][0-9]|3[01]',
          d: options.strict ? '[1-9]|[1-2][0-9]|3[01]' : '0?[1-9]|[1-2][0-9]|3[01]',
          MMMM: $locale.DATETIME_FORMATS.MONTH.join('|'),
          MMM: $locale.DATETIME_FORMATS.SHORTMONTH.join('|'),
          MM: '0[1-9]|1[012]',
          M: options.strict ? '[1-9]|1[012]' : '0?[1-9]|1[012]',
          yyyy: '[1]{1}[0-9]{3}|[2]{1}[0-9]{3}',
          yy: '[0-9]{2}',
          y: options.strict ? '-?(0|[1-9][0-9]{0,3})' : '-?0*[0-9]{1,4}'
        };
        var setFnMap = {
          sss: proto.setMilliseconds,
          ss: proto.setSeconds,
          s: proto.setSeconds,
          mm: proto.setMinutes,
          m: proto.setMinutes,
          HH: proto.setHours,
          H: proto.setHours,
          hh: proto.setHours,
          h: proto.setHours,
          EEEE: noop,
          EEE: noop,
          dd: proto.setDate,
          d: proto.setDate,
          a: function(value) {
            var hours = this.getHours() % 12;
            return this.setHours(value.match(/pm/i) ? hours + 12 : hours);
          },
          MMMM: function(value) {
            return this.setMonth(indexOfCaseInsensitive($locale.DATETIME_FORMATS.MONTH, value));
          },
          MMM: function(value) {
            return this.setMonth(indexOfCaseInsensitive($locale.DATETIME_FORMATS.SHORTMONTH, value));
          },
          MM: function(value) {
            return this.setMonth(1 * value - 1);
          },
          M: function(value) {
            return this.setMonth(1 * value - 1);
          },
          yyyy: proto.setFullYear,
          yy: function(value) {
            return this.setFullYear(2e3 + 1 * value);
          },
          y: function(value) {
            return 1 * value <= 50 && value.length === 2 ? this.setFullYear(2e3 + 1 * value) : this.setFullYear(1 * value);
          }
        };
        var regex;
        var setMap;
        $dateParser.init = function() {
          $dateParser.$format = $locale.DATETIME_FORMATS[options.format] || options.format;
          regex = regExpForFormat($dateParser.$format);
          setMap = setMapForFormat($dateParser.$format);
        };
        $dateParser.isValid = function(date) {
          if (angular.isDate(date)) return !isNaN(date.getTime());
          return regex.test(date);
        };
        $dateParser.parse = function(value, baseDate, format, timezone) {
          if (format) format = $locale.DATETIME_FORMATS[format] || format;
          if (angular.isDate(value)) value = dateFilter(value, format || $dateParser.$format, timezone);
          var formatRegex = format ? regExpForFormat(format) : regex;
          var formatSetMap = format ? setMapForFormat(format) : setMap;
          var matches = formatRegex.exec(value);
          if (!matches) return false;
          var date = baseDate && !isNaN(baseDate.getTime()) ? new ParseDate().fromDate(baseDate) : new ParseDate().fromDate(new Date(1970, 0, 1, 0));
          for (var i = 0; i < matches.length - 1; i++) {
            if (formatSetMap[i]) formatSetMap[i].call(date, matches[i + 1]);
          }
          var newDate = date.toDate();
          if (parseInt(date.day, 10) !== newDate.getDate()) {
            return false;
          }
          return newDate;
        };
        $dateParser.getDateForAttribute = function(key, value) {
          var date;
          if (value === 'today') {
            var today = new Date();
            date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (key === 'maxDate' ? 1 : 0), 0, 0, 0, key === 'minDate' ? 0 : -1);
          } else if (angular.isString(value) && value.match(/^".+"$/)) {
            date = new Date(value.substr(1, value.length - 2));
          } else if (isNumeric(value)) {
            date = new Date(parseInt(value, 10));
          } else if (angular.isString(value) && value.length === 0) {
            date = key === 'minDate' ? -Infinity : +Infinity;
          } else {
            date = new Date(value);
          }
          return date;
        };
        $dateParser.getTimeForAttribute = function(key, value) {
          var time;
          if (value === 'now') {
            time = new Date().setFullYear(1970, 0, 1);
          } else if (angular.isString(value) && value.match(/^".+"$/)) {
            time = new Date(value.substr(1, value.length - 2)).setFullYear(1970, 0, 1);
          } else if (isNumeric(value)) {
            time = new Date(parseInt(value, 10)).setFullYear(1970, 0, 1);
          } else if (angular.isString(value) && value.length === 0) {
            time = key === 'minTime' ? -Infinity : +Infinity;
          } else {
            time = $dateParser.parse(value, new Date(1970, 0, 1, 0));
          }
          return time;
        };
        $dateParser.daylightSavingAdjust = function(date) {
          if (!date) {
            return null;
          }
          date.setHours(date.getHours() > 12 ? date.getHours() + 2 : 0);
          return date;
        };
        $dateParser.timezoneOffsetAdjust = function(date, timezone, undo) {
          if (!date) {
            return null;
          }
          if (timezone && timezone === 'UTC') {
            date = new Date(date.getTime());
            date.setMinutes(date.getMinutes() + (undo ? -1 : 1) * date.getTimezoneOffset());
          }
          return date;
        };
        function regExpForFormat(format) {
          var re = buildDateAbstractRegex(format);
          return buildDateParseRegex(re);
        }
        function buildDateAbstractRegex(format) {
          var escapedFormat = escapeReservedSymbols(format);
          var escapedLiteralFormat = escapedFormat.replace(/''/g, '\\\'');
          var literalRegex = /('(?:\\'|.)*?')/;
          var formatParts = escapedLiteralFormat.split(literalRegex);
          var dateElements = Object.keys(regExpMap);
          var dateRegexParts = [];
          angular.forEach(formatParts, function(part) {
            if (isFormatStringLiteral(part)) {
              part = trimLiteralEscapeChars(part);
            } else {
              for (var i = 0; i < dateElements.length; i++) {
                part = part.split(dateElements[i]).join('${' + i + '}');
              }
            }
            dateRegexParts.push(part);
          });
          return dateRegexParts.join('');
        }
        function escapeReservedSymbols(text) {
          return text.replace(/\\/g, '[\\\\]').replace(/-/g, '[-]').replace(/\./g, '[.]').replace(/\*/g, '[*]').replace(/\+/g, '[+]').replace(/\?/g, '[?]').replace(/\$/g, '[$]').replace(/\^/g, '[^]').replace(/\//g, '[/]').replace(/\\s/g, '[\\s]');
        }
        function isFormatStringLiteral(text) {
          return /^'.*'$/.test(text);
        }
        function trimLiteralEscapeChars(text) {
          return text.replace(/^'(.*)'$/, '$1');
        }
        function buildDateParseRegex(abstractRegex) {
          var dateElements = Object.keys(regExpMap);
          var re = abstractRegex;
          for (var i = 0; i < dateElements.length; i++) {
            re = re.split('${' + i + '}').join('(' + regExpMap[dateElements[i]] + ')');
          }
          return new RegExp('^' + re + '$', [ 'i' ]);
        }
        function setMapForFormat(format) {
          var re = buildDateAbstractRegex(format);
          return buildDateParseValuesMap(re);
        }
        function buildDateParseValuesMap(abstractRegex) {
          var dateElements = Object.keys(regExpMap);
          var valuesRegex = new RegExp('\\${(\\d+)}', 'g');
          var valuesMatch;
          var keyIndex;
          var valueKey;
          var valueFunction;
          var valuesFunctionMap = [];
          while ((valuesMatch = valuesRegex.exec(abstractRegex)) !== null) {
            keyIndex = valuesMatch[1];
            valueKey = dateElements[keyIndex];
            valueFunction = setFnMap[valueKey];
            valuesFunctionMap.push(valueFunction);
          }
          return valuesFunctionMap;
        }
        $dateParser.init();
        return $dateParser;
      };
      return DateParserFactory;
    } ];
  } ]);
  angular.module('mgcrea.ngStrap.helpers.dateFormatter', []).service('$dateFormatter', [ '$locale', 'dateFilter', function($locale, dateFilter) {
    this.getDefaultLocale = function() {
      return $locale.id;
    };
    this.getDatetimeFormat = function(format, lang) {
      return $locale.DATETIME_FORMATS[format] || format;
    };
    this.weekdaysShort = function(lang) {
      return $locale.DATETIME_FORMATS.SHORTDAY;
    };
    function splitTimeFormat(format) {
      return /(h+)([:\.])?(m+)([:\.])?(s*)[ ]?(a?)/i.exec(format).slice(1);
    }
    this.hoursFormat = function(timeFormat) {
      return splitTimeFormat(timeFormat)[0];
    };
    this.minutesFormat = function(timeFormat) {
      return splitTimeFormat(timeFormat)[2];
    };
    this.secondsFormat = function(timeFormat) {
      return splitTimeFormat(timeFormat)[4];
    };
    this.timeSeparator = function(timeFormat) {
      return splitTimeFormat(timeFormat)[1];
    };
    this.showSeconds = function(timeFormat) {
      return !!splitTimeFormat(timeFormat)[4];
    };
    this.showAM = function(timeFormat) {
      return !!splitTimeFormat(timeFormat)[5];
    };
    this.formatDate = function(date, format, lang, timezone) {
      return dateFilter(date, format, timezone);
    };
  } ]);
  angular.module('mgcrea.ngStrap.core', []).service('$bsCompiler', bsCompilerService);
  function bsCompilerService($q, $http, $injector, $compile, $controller, $templateCache) {
    this.compile = function(options) {
      if (options.template && /\.html$/.test(options.template)) {
        console.warn('Deprecated use of `template` option to pass a file. Please use the `templateUrl` option instead.');
        options.templateUrl = options.template;
        options.template = '';
      }
      var templateUrl = options.templateUrl;
      var template = options.template || '';
      var controller = options.controller;
      var controllerAs = options.controllerAs;
      var resolve = options.resolve || {};
      var locals = options.locals || {};
      var transformTemplate = options.transformTemplate || angular.identity;
      var bindToController = options.bindToController;
      angular.forEach(resolve, function(value, key) {
        if (angular.isString(value)) {
          resolve[key] = $injector.get(value);
        } else {
          resolve[key] = $injector.invoke(value);
        }
      });
      angular.extend(resolve, locals);
      if (template) {
        resolve.$template = $q.when(template);
      } else if (templateUrl) {
        resolve.$template = fetchTemplate(templateUrl);
      } else {
        throw new Error('Missing `template` / `templateUrl` option.');
      }
      if (options.titleTemplate) {
        resolve.$template = $q.all([ resolve.$template, fetchTemplate(options.titleTemplate) ]).then(function(templates) {
          var templateEl = angular.element(templates[0]);
          findElement('[ng-bind="title"]', templateEl[0]).removeAttr('ng-bind').html(templates[1]);
          return templateEl[0].outerHTML;
        });
      }
      if (options.contentTemplate) {
        resolve.$template = $q.all([ resolve.$template, fetchTemplate(options.contentTemplate) ]).then(function(templates) {
          var templateEl = angular.element(templates[0]);
          var contentEl = findElement('[ng-bind="content"]', templateEl[0]).removeAttr('ng-bind').html(templates[1]);
          if (!options.templateUrl) contentEl.next().remove();
          return templateEl[0].outerHTML;
        });
      }
      return $q.all(resolve).then(function(locals) {
        var template = transformTemplate(locals.$template);
        if (options.html) {
          template = template.replace(/ng-bind="/gi, 'ng-bind-html="');
        }
        var element = angular.element('<div>').html(template.trim()).contents();
        var linkFn = $compile(element);
        return {
          locals: locals,
          element: element,
          link: function link(scope) {
            locals.$scope = scope;
            if (controller) {
              var invokeCtrl = $controller(controller, locals, true);
              if (bindToController) {
                angular.extend(invokeCtrl.instance, locals);
              }
              var ctrl = angular.isObject(invokeCtrl) ? invokeCtrl : invokeCtrl();
              element.data('$ngControllerController', ctrl);
              element.children().data('$ngControllerController', ctrl);
              if (controllerAs) {
                scope[controllerAs] = ctrl;
              }
            }
            return linkFn.apply(null, arguments);
          }
        };
      });
    };
    function findElement(query, element) {
      return angular.element((element || document).querySelectorAll(query));
    }
    var fetchPromises = {};
    function fetchTemplate(template) {
      if (fetchPromises[template]) return fetchPromises[template];
      return fetchPromises[template] = $http.get(template, {
        cache: $templateCache
      }).then(function(res) {
        return res.data;
      });
    }
  }
  angular.module('mgcrea.ngStrap.dropdown', [ 'mgcrea.ngStrap.tooltip' ]).provider('$dropdown', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      prefixClass: 'dropdown',
      prefixEvent: 'dropdown',
      placement: 'bottom-left',
      templateUrl: 'dropdown/dropdown.tpl.html',
      trigger: 'click',
      container: false,
      keyboard: true,
      html: false,
      delay: 0
    };
    this.$get = [ '$window', '$rootScope', '$tooltip', '$timeout', function($window, $rootScope, $tooltip, $timeout) {
      var bodyEl = angular.element($window.document.body);
      var matchesSelector = Element.prototype.matchesSelector || Element.prototype.webkitMatchesSelector || Element.prototype.mozMatchesSelector || Element.prototype.msMatchesSelector || Element.prototype.oMatchesSelector;
      function DropdownFactory(element, config) {
        var $dropdown = {};
        var options = angular.extend({}, defaults, config);
        $dropdown.$scope = options.scope && options.scope.$new() || $rootScope.$new();
        $dropdown = $tooltip(element, options);
        var parentEl = element.parent();
        $dropdown.$onKeyDown = function(evt) {
          if (!/(38|40)/.test(evt.keyCode)) return;
          evt.preventDefault();
          evt.stopPropagation();
          var items = angular.element($dropdown.$element[0].querySelectorAll('li:not(.divider) a'));
          if (!items.length) return;
          var index;
          angular.forEach(items, function(el, i) {
            if (matchesSelector && matchesSelector.call(el, ':focus')) index = i;
          });
          if (evt.keyCode === 38 && index > 0) index--; else if (evt.keyCode === 40 && index < items.length - 1) index++; else if (angular.isUndefined(index)) index = 0;
          items.eq(index)[0].focus();
        };
        var show = $dropdown.show;
        $dropdown.show = function() {
          show();
          $timeout(function() {
            if (options.keyboard && $dropdown.$element) $dropdown.$element.on('keydown', $dropdown.$onKeyDown);
            bodyEl.on('click', onBodyClick);
          }, 0, false);
          if (parentEl.hasClass('dropdown')) parentEl.addClass('open');
        };
        var hide = $dropdown.hide;
        $dropdown.hide = function() {
          if (!$dropdown.$isShown) return;
          if (options.keyboard && $dropdown.$element) $dropdown.$element.off('keydown', $dropdown.$onKeyDown);
          bodyEl.off('click', onBodyClick);
          if (parentEl.hasClass('dropdown')) parentEl.removeClass('open');
          hide();
        };
        var destroy = $dropdown.destroy;
        $dropdown.destroy = function() {
          bodyEl.off('click', onBodyClick);
          destroy();
        };
        function onBodyClick(evt) {
          if (evt.target === element[0]) return;
          return evt.target !== element[0] && $dropdown.hide();
        }
        return $dropdown;
      }
      return DropdownFactory;
    } ];
  }).directive('bsDropdown', [ '$window', '$sce', '$dropdown', function($window, $sce, $dropdown) {
    return {
      restrict: 'EAC',
      scope: true,
      compile: function(tElement, tAttrs) {
        if (!tAttrs.bsDropdown) {
          var nextSibling = tElement[0].nextSibling;
          while (nextSibling && nextSibling.nodeType !== 1) {
            nextSibling = nextSibling.nextSibling;
          }
          if (nextSibling && nextSibling.className.split(' ').indexOf('dropdown-menu') >= 0) {
            tAttrs.template = nextSibling.outerHTML;
            tAttrs.templateUrl = undefined;
            nextSibling.parentNode.removeChild(nextSibling);
          }
        }
        return function postLink(scope, element, attr) {
          var options = {
            scope: scope
          };
          angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'placement', 'container', 'delay', 'trigger', 'keyboard', 'html', 'animation', 'id', 'autoClose' ], function(key) {
            if (angular.isDefined(tAttrs[key])) options[key] = tAttrs[key];
          });
          var falseValueRegExp = /^(false|0|)$/i;
          angular.forEach([ 'html', 'container' ], function(key) {
            if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) options[key] = false;
          });
          angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
            var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
            if (angular.isDefined(attr[bsKey])) {
              options[key] = scope.$eval(attr[bsKey]);
            }
          });
          if (attr.bsDropdown) {
            scope.$watch(attr.bsDropdown, function(newValue, oldValue) {
              scope.content = newValue;
            }, true);
          }
          var dropdown = $dropdown(element, options);
          if (attr.bsShow) {
            scope.$watch(attr.bsShow, function(newValue, oldValue) {
              if (!dropdown || !angular.isDefined(newValue)) return;
              if (angular.isString(newValue)) newValue = !!newValue.match(/true|,?(dropdown),?/i);
              if (newValue === true) {
                dropdown.show();
              } else {
                dropdown.hide();
              }
            });
          }
          scope.$on('$destroy', function() {
            if (dropdown) dropdown.destroy();
            options = null;
            dropdown = null;
          });
        };
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.button', []).provider('$button', function() {
    var defaults = this.defaults = {
      activeClass: 'active',
      toggleEvent: 'click'
    };
    this.$get = function() {
      return {
        defaults: defaults
      };
    };
  }).directive('bsCheckboxGroup', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      compile: function postLink(element, attr) {
        element.attr('data-toggle', 'buttons');
        element.removeAttr('ng-model');
        var children = element[0].querySelectorAll('input[type="checkbox"]');
        angular.forEach(children, function(child) {
          var childEl = angular.element(child);
          childEl.attr('bs-checkbox', '');
          childEl.attr('ng-model', attr.ngModel + '.' + childEl.attr('value'));
        });
      }
    };
  }).directive('bsCheckbox', [ '$button', '$$rAF', function($button, $$rAF) {
    var defaults = $button.defaults;
    var constantValueRegExp = /^(true|false|\d+)$/;
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        var options = defaults;
        var isInput = element[0].nodeName === 'INPUT';
        var activeElement = isInput ? element.parent() : element;
        var trueValue = angular.isDefined(attr.trueValue) ? attr.trueValue : true;
        if (constantValueRegExp.test(attr.trueValue)) {
          trueValue = scope.$eval(attr.trueValue);
        }
        var falseValue = angular.isDefined(attr.falseValue) ? attr.falseValue : false;
        if (constantValueRegExp.test(attr.falseValue)) {
          falseValue = scope.$eval(attr.falseValue);
        }
        var hasExoticValues = typeof trueValue !== 'boolean' || typeof falseValue !== 'boolean';
        if (hasExoticValues) {
          controller.$parsers.push(function(viewValue) {
            return viewValue ? trueValue : falseValue;
          });
          controller.$formatters.push(function(modelValue) {
            return angular.equals(modelValue, trueValue);
          });
        }
        controller.$render = function() {
          var isActive = !!controller.$viewValue;
          $$rAF(function() {
            if (isInput) element[0].checked = isActive;
            activeElement.toggleClass(options.activeClass, isActive);
          });
        };
        element.bind(options.toggleEvent, function() {
          scope.$apply(function() {
            if (!isInput) {
              controller.$setViewValue(!activeElement.hasClass('active'));
            }
            controller.$render();
          });
        });
      }
    };
  } ]).directive('bsRadioGroup', function() {
    return {
      restrict: 'A',
      require: 'ngModel',
      compile: function postLink(element, attr) {
        element.attr('data-toggle', 'buttons');
        element.removeAttr('ng-model');
        var children = element[0].querySelectorAll('input[type="radio"]');
        angular.forEach(children, function(child) {
          angular.element(child).attr('bs-radio', '');
          angular.element(child).attr('ng-model', attr.ngModel);
        });
      }
    };
  }).directive('bsRadio', [ '$button', '$$rAF', function($button, $$rAF) {
    var defaults = $button.defaults;
    var constantValueRegExp = /^(true|false|\d+)$/;
    return {
      restrict: 'A',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        var options = defaults;
        var isInput = element[0].nodeName === 'INPUT';
        var activeElement = isInput ? element.parent() : element;
        var value;
        attr.$observe('value', function(v) {
          if (typeof v !== 'boolean' && constantValueRegExp.test(v)) {
            value = scope.$eval(v);
          } else {
            value = v;
          }
          controller.$render();
        });
        controller.$render = function() {
          var isActive = angular.equals(controller.$viewValue, value);
          $$rAF(function() {
            if (isInput) element[0].checked = isActive;
            activeElement.toggleClass(options.activeClass, isActive);
          });
        };
        element.bind(options.toggleEvent, function() {
          scope.$apply(function() {
            controller.$setViewValue(value);
            controller.$render();
          });
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.datepicker', [ 'mgcrea.ngStrap.helpers.dateParser', 'mgcrea.ngStrap.helpers.dateFormatter', 'mgcrea.ngStrap.tooltip' ]).provider('$datepicker', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      prefixClass: 'datepicker',
      placement: 'bottom-left',
      templateUrl: 'datepicker/datepicker.tpl.html',
      trigger: 'focus',
      container: false,
      keyboard: true,
      html: false,
      delay: 0,
      useNative: false,
      dateType: 'date',
      dateFormat: 'shortDate',
      timezone: null,
      modelDateFormat: null,
      dayFormat: 'dd',
      monthFormat: 'MMM',
      yearFormat: 'yyyy',
      monthTitleFormat: 'MMMM yyyy',
      yearTitleFormat: 'yyyy',
      strictFormat: false,
      autoclose: false,
      minDate: -Infinity,
      maxDate: +Infinity,
      startView: 0,
      minView: 0,
      startWeek: 0,
      daysOfWeekDisabled: '',
      hasToday: false,
      hasClear: false,
      iconLeft: 'glyphicon glyphicon-chevron-left',
      iconRight: 'glyphicon glyphicon-chevron-right'
    };
    this.$get = [ '$window', '$document', '$rootScope', '$sce', '$dateFormatter', 'datepickerViews', '$tooltip', '$timeout', function($window, $document, $rootScope, $sce, $dateFormatter, datepickerViews, $tooltip, $timeout) {
      var isNative = /(ip[ao]d|iphone|android)/gi.test($window.navigator.userAgent);
      var isTouch = 'createTouch' in $window.document && isNative;
      if (!defaults.lang) defaults.lang = $dateFormatter.getDefaultLocale();
      function DatepickerFactory(element, controller, config) {
        var $datepicker = $tooltip(element, angular.extend({}, defaults, config));
        var parentScope = config.scope;
        var options = $datepicker.$options;
        var scope = $datepicker.$scope;
        if (options.startView) options.startView -= options.minView;
        var pickerViews = datepickerViews($datepicker);
        $datepicker.$views = pickerViews.views;
        var viewDate = pickerViews.viewDate;
        scope.$mode = options.startView;
        scope.$iconLeft = options.iconLeft;
        scope.$iconRight = options.iconRight;
        scope.$hasToday = options.hasToday;
        scope.$hasClear = options.hasClear;
        var $picker = $datepicker.$views[scope.$mode];
        scope.$select = function(date, disabled) {
          if (disabled) return;
          $datepicker.select(date);
        };
        scope.$selectPane = function(value) {
          $datepicker.$selectPane(value);
        };
        scope.$toggleMode = function() {
          $datepicker.setMode((scope.$mode + 1) % $datepicker.$views.length);
        };
        scope.$setToday = function() {
          if (options.autoclose) {
            $datepicker.setMode(0);
            $datepicker.select(new Date());
          } else {
            $datepicker.select(new Date(), true);
          }
        };
        scope.$clear = function() {
          if (options.autoclose) {
            $datepicker.setMode(0);
            $datepicker.select(null);
          } else {
            $datepicker.select(null, true);
          }
        };
        $datepicker.update = function(date) {
          if (angular.isDate(date) && !isNaN(date.getTime())) {
            $datepicker.$date = date;
            $picker.update.call($picker, date);
          }
          $datepicker.$build(true);
        };
        $datepicker.updateDisabledDates = function(dateRanges) {
          options.disabledDateRanges = dateRanges;
          for (var i = 0, l = scope.rows.length; i < l; i++) {
            angular.forEach(scope.rows[i], $datepicker.$setDisabledEl);
          }
        };
        $datepicker.select = function(date, keep) {
          if (angular.isDate(date)) {
            if (!angular.isDate(controller.$dateValue) || isNaN(controller.$dateValue.getTime())) {
              controller.$dateValue = new Date(date);
            }
          } else {
            controller.$dateValue = null;
          }
          if (!scope.$mode || keep) {
            controller.$setViewValue(angular.copy(date));
            controller.$render();
            if (options.autoclose && !keep) {
              $timeout(function() {
                $datepicker.hide(true);
              });
            }
          } else {
            angular.extend(viewDate, {
              year: date.getFullYear(),
              month: date.getMonth(),
              date: date.getDate()
            });
            $datepicker.setMode(scope.$mode - 1);
            $datepicker.$build();
          }
        };
        $datepicker.setMode = function(mode) {
          scope.$mode = mode;
          $picker = $datepicker.$views[scope.$mode];
          $datepicker.$build();
        };
        $datepicker.$build = function(pristine) {
          if (pristine === true && $picker.built) return;
          if (pristine === false && !$picker.built) return;
          $picker.build.call($picker);
        };
        $datepicker.$updateSelected = function() {
          for (var i = 0, l = scope.rows.length; i < l; i++) {
            angular.forEach(scope.rows[i], updateSelected);
          }
        };
        $datepicker.$isSelected = function(date) {
          return $picker.isSelected(date);
        };
        $datepicker.$setDisabledEl = function(el) {
          el.disabled = $picker.isDisabled(el.date);
        };
        $datepicker.$selectPane = function(value) {
          var steps = $picker.steps;
          var targetDate = new Date(Date.UTC(viewDate.year + (steps.year || 0) * value, viewDate.month + (steps.month || 0) * value, 1));
          angular.extend(viewDate, {
            year: targetDate.getUTCFullYear(),
            month: targetDate.getUTCMonth(),
            date: targetDate.getUTCDate()
          });
          $datepicker.$build();
        };
        $datepicker.$onMouseDown = function(evt) {
          evt.preventDefault();
          evt.stopPropagation();
          if (isTouch) {
            var targetEl = angular.element(evt.target);
            if (targetEl[0].nodeName.toLowerCase() !== 'button') {
              targetEl = targetEl.parent();
            }
            targetEl.triggerHandler('click');
          }
        };
        $datepicker.$onKeyDown = function(evt) {
          if (!/(38|37|39|40|13)/.test(evt.keyCode) || evt.shiftKey || evt.altKey) return;
          evt.preventDefault();
          evt.stopPropagation();
          if (evt.keyCode === 13) {
            if (!scope.$mode) {
              $datepicker.hide(true);
            } else {
              scope.$apply(function() {
                $datepicker.setMode(scope.$mode - 1);
              });
            }
            return;
          }
          $picker.onKeyDown(evt);
          parentScope.$digest();
        };
        function updateSelected(el) {
          el.selected = $datepicker.$isSelected(el.date);
        }
        function focusElement() {
          element[0].focus();
        }
        var _init = $datepicker.init;
        $datepicker.init = function() {
          if (isNative && options.useNative) {
            element.prop('type', 'date');
            element.css('-webkit-appearance', 'textfield');
            return;
          } else if (isTouch) {
            element.prop('type', 'text');
            element.attr('readonly', 'true');
            element.on('click', focusElement);
          }
          _init();
        };
        var _destroy = $datepicker.destroy;
        $datepicker.destroy = function() {
          if (isNative && options.useNative) {
            element.off('click', focusElement);
          }
          _destroy();
        };
        var _show = $datepicker.show;
        $datepicker.show = function() {
          if (!isTouch && element.attr('readonly') || element.attr('disabled')) return;
          _show();
          $timeout(function() {
            if (!$datepicker.$isShown) return;
            $datepicker.$element.on(isTouch ? 'touchstart' : 'mousedown', $datepicker.$onMouseDown);
            if (options.keyboard) {
              element.on('keydown', $datepicker.$onKeyDown);
            }
          }, 0, false);
        };
        var _hide = $datepicker.hide;
        $datepicker.hide = function(blur) {
          if (!$datepicker.$isShown) return;
          $datepicker.$element.off(isTouch ? 'touchstart' : 'mousedown', $datepicker.$onMouseDown);
          if (options.keyboard) {
            element.off('keydown', $datepicker.$onKeyDown);
          }
          _hide(blur);
        };
        return $datepicker;
      }
      DatepickerFactory.defaults = defaults;
      return DatepickerFactory;
    } ];
  }).directive('bsDatepicker', [ '$window', '$parse', '$q', '$dateFormatter', '$dateParser', '$datepicker', function($window, $parse, $q, $dateFormatter, $dateParser, $datepicker) {
    var isNative = /(ip[ao]d|iphone|android)/gi.test($window.navigator.userAgent);
    return {
      restrict: 'EAC',
      require: 'ngModel',
      link: function postLink(scope, element, attr, controller) {
        var options = {
          scope: scope
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'placement', 'container', 'delay', 'trigger', 'html', 'animation', 'autoclose', 'dateType', 'dateFormat', 'timezone', 'modelDateFormat', 'dayFormat', 'strictFormat', 'startWeek', 'startDate', 'useNative', 'lang', 'startView', 'minView', 'iconLeft', 'iconRight', 'daysOfWeekDisabled', 'id', 'prefixClass', 'prefixEvent', 'hasToday', 'hasClear' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'html', 'container', 'autoclose', 'useNative', 'hasToday', 'hasClear' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) {
            options[key] = false;
          }
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        var datepicker = $datepicker(element, controller, options);
        options = datepicker.$options;
        if (isNative && options.useNative) options.dateFormat = 'yyyy-MM-dd';
        var lang = options.lang;
        var formatDate = function(date, format) {
          return $dateFormatter.formatDate(date, format, lang);
        };
        var dateParser = $dateParser({
          format: options.dateFormat,
          lang: lang,
          strict: options.strictFormat
        });
        if (attr.bsShow) {
          scope.$watch(attr.bsShow, function(newValue, oldValue) {
            if (!datepicker || !angular.isDefined(newValue)) return;
            if (angular.isString(newValue)) newValue = !!newValue.match(/true|,?(datepicker),?/i);
            if (newValue === true) {
              datepicker.show();
            } else {
              datepicker.hide();
            }
          });
        }
        angular.forEach([ 'minDate', 'maxDate' ], function(key) {
          if (angular.isDefined(attr[key])) {
            attr.$observe(key, function(newValue) {
              datepicker.$options[key] = dateParser.getDateForAttribute(key, newValue);
              if (!isNaN(datepicker.$options[key])) datepicker.$build(false);
              validateAgainstMinMaxDate(controller.$dateValue);
            });
          }
        });
        if (angular.isDefined(attr.dateFormat)) {
          attr.$observe('dateFormat', function(newValue) {
            datepicker.$options.dateFormat = newValue;
          });
        }
        scope.$watch(attr.ngModel, function(newValue, oldValue) {
          datepicker.update(controller.$dateValue);
        }, true);
        function normalizeDateRanges(ranges) {
          if (!ranges || !ranges.length) return null;
          return ranges;
        }
        if (angular.isDefined(attr.disabledDates)) {
          scope.$watch(attr.disabledDates, function(disabledRanges, previousValue) {
            disabledRanges = normalizeDateRanges(disabledRanges);
            previousValue = normalizeDateRanges(previousValue);
            if (disabledRanges) {
              datepicker.updateDisabledDates(disabledRanges);
            }
          });
        }
        function validateAgainstMinMaxDate(parsedDate) {
          if (!angular.isDate(parsedDate)) return;
          var isMinValid = isNaN(datepicker.$options.minDate) || parsedDate.getTime() >= datepicker.$options.minDate;
          var isMaxValid = isNaN(datepicker.$options.maxDate) || parsedDate.getTime() <= datepicker.$options.maxDate;
          var isValid = isMinValid && isMaxValid;
          controller.$setValidity('date', isValid);
          controller.$setValidity('min', isMinValid);
          controller.$setValidity('max', isMaxValid);
          if (isValid) controller.$dateValue = parsedDate;
        }
        controller.$parsers.unshift(function(viewValue) {
          var date;
          if (!viewValue) {
            controller.$setValidity('date', true);
            return null;
          }
          var parsedDate = dateParser.parse(viewValue, controller.$dateValue);
          if (!parsedDate || isNaN(parsedDate.getTime())) {
            controller.$setValidity('date', false);
            return;
          }
          validateAgainstMinMaxDate(parsedDate);
          if (options.dateType === 'string') {
            date = dateParser.timezoneOffsetAdjust(parsedDate, options.timezone, true);
            return formatDate(date, options.modelDateFormat || options.dateFormat);
          }
          date = dateParser.timezoneOffsetAdjust(controller.$dateValue, options.timezone, true);
          if (options.dateType === 'number') {
            return date.getTime();
          } else if (options.dateType === 'unix') {
            return date.getTime() / 1e3;
          } else if (options.dateType === 'iso') {
            return date.toISOString();
          }
          return new Date(date);
        });
        controller.$formatters.push(function(modelValue) {
          var date;
          if (angular.isUndefined(modelValue) || modelValue === null) {
            date = NaN;
          } else if (angular.isDate(modelValue)) {
            date = modelValue;
          } else if (options.dateType === 'string') {
            date = dateParser.parse(modelValue, null, options.modelDateFormat);
          } else if (options.dateType === 'unix') {
            date = new Date(modelValue * 1e3);
          } else {
            date = new Date(modelValue);
          }
          controller.$dateValue = dateParser.timezoneOffsetAdjust(date, options.timezone);
          return getDateFormattedString();
        });
        controller.$render = function() {
          element.val(getDateFormattedString());
        };
        function getDateFormattedString() {
          return !controller.$dateValue || isNaN(controller.$dateValue.getTime()) ? '' : formatDate(controller.$dateValue, options.dateFormat);
        }
        scope.$on('$destroy', function() {
          if (datepicker) datepicker.destroy();
          options = null;
          datepicker = null;
        });
      }
    };
  } ]).provider('datepickerViews', function() {
    function split(arr, size) {
      var arrays = [];
      while (arr.length > 0) {
        arrays.push(arr.splice(0, size));
      }
      return arrays;
    }
    function mod(n, m) {
      return (n % m + m) % m;
    }
    this.$get = [ '$dateFormatter', '$dateParser', '$sce', function($dateFormatter, $dateParser, $sce) {
      return function(picker) {
        var scope = picker.$scope;
        var options = picker.$options;
        var lang = options.lang;
        var formatDate = function(date, format) {
          return $dateFormatter.formatDate(date, format, lang);
        };
        var dateParser = $dateParser({
          format: options.dateFormat,
          lang: lang,
          strict: options.strictFormat
        });
        var weekDaysMin = $dateFormatter.weekdaysShort(lang);
        var weekDaysLabels = weekDaysMin.slice(options.startWeek).concat(weekDaysMin.slice(0, options.startWeek));
        var weekDaysLabelsHtml = $sce.trustAsHtml('<th class="dow text-center">' + weekDaysLabels.join('</th><th class="dow text-center">') + '</th>');
        var startDate = picker.$date || (options.startDate ? dateParser.getDateForAttribute('startDate', options.startDate) : new Date());
        var viewDate = {
          year: startDate.getFullYear(),
          month: startDate.getMonth(),
          date: startDate.getDate()
        };
        var views = [ {
          format: options.dayFormat,
          split: 7,
          steps: {
            month: 1
          },
          update: function(date, force) {
            if (!this.built || force || date.getFullYear() !== viewDate.year || date.getMonth() !== viewDate.month) {
              angular.extend(viewDate, {
                year: picker.$date.getFullYear(),
                month: picker.$date.getMonth(),
                date: picker.$date.getDate()
              });
              picker.$build();
            } else if (date.getDate() !== viewDate.date || date.getDate() === 1) {
              viewDate.date = picker.$date.getDate();
              picker.$updateSelected();
            }
          },
          build: function() {
            var firstDayOfMonth = new Date(viewDate.year, viewDate.month, 1);
            var firstDayOfMonthOffset = firstDayOfMonth.getTimezoneOffset();
            var firstDate = new Date(+firstDayOfMonth - mod(firstDayOfMonth.getDay() - options.startWeek, 7) * 864e5);
            var firstDateOffset = firstDate.getTimezoneOffset();
            var today = dateParser.timezoneOffsetAdjust(new Date(), options.timezone).toDateString();
            if (firstDateOffset !== firstDayOfMonthOffset) firstDate = new Date(+firstDate + (firstDateOffset - firstDayOfMonthOffset) * 6e4);
            var days = [];
            var day;
            for (var i = 0; i < 42; i++) {
              day = dateParser.daylightSavingAdjust(new Date(firstDate.getFullYear(), firstDate.getMonth(), firstDate.getDate() + i));
              days.push({
                date: day,
                isToday: day.toDateString() === today,
                label: formatDate(day, this.format),
                selected: picker.$date && this.isSelected(day),
                muted: day.getMonth() !== viewDate.month,
                disabled: this.isDisabled(day)
              });
            }
            scope.title = formatDate(firstDayOfMonth, options.monthTitleFormat);
            scope.showLabels = true;
            scope.labels = weekDaysLabelsHtml;
            scope.rows = split(days, this.split);
            scope.isTodayDisabled = this.isDisabled(new Date());
            this.built = true;
          },
          isSelected: function(date) {
            return picker.$date && date.getFullYear() === picker.$date.getFullYear() && date.getMonth() === picker.$date.getMonth() && date.getDate() === picker.$date.getDate();
          },
          isDisabled: function(date) {
            var time = date.getTime();
            if (time < options.minDate || time > options.maxDate) return true;
            if (options.daysOfWeekDisabled.indexOf(date.getDay()) !== -1) return true;
            if (options.disabledDateRanges) {
              for (var i = 0; i < options.disabledDateRanges.length; i++) {
                if (time >= options.disabledDateRanges[i].start && time <= options.disabledDateRanges[i].end) {
                  return true;
                }
              }
            }
            return false;
          },
          onKeyDown: function(evt) {
            if (!picker.$date) {
              return;
            }
            var actualTime = picker.$date.getTime();
            var newDate;
            if (evt.keyCode === 37) newDate = new Date(actualTime - 1 * 864e5); else if (evt.keyCode === 38) newDate = new Date(actualTime - 7 * 864e5); else if (evt.keyCode === 39) newDate = new Date(actualTime + 1 * 864e5); else if (evt.keyCode === 40) newDate = new Date(actualTime + 7 * 864e5);
            if (!this.isDisabled(newDate)) picker.select(newDate, true);
          }
        }, {
          name: 'month',
          format: options.monthFormat,
          split: 4,
          steps: {
            year: 1
          },
          update: function(date, force) {
            if (!this.built || date.getFullYear() !== viewDate.year) {
              angular.extend(viewDate, {
                year: picker.$date.getFullYear(),
                month: picker.$date.getMonth(),
                date: picker.$date.getDate()
              });
              picker.$build();
            } else if (date.getMonth() !== viewDate.month) {
              angular.extend(viewDate, {
                month: picker.$date.getMonth(),
                date: picker.$date.getDate()
              });
              picker.$updateSelected();
            }
          },
          build: function() {
            var months = [];
            var month;
            for (var i = 0; i < 12; i++) {
              month = new Date(viewDate.year, i, 1);
              months.push({
                date: month,
                label: formatDate(month, this.format),
                selected: picker.$isSelected(month),
                disabled: this.isDisabled(month)
              });
            }
            scope.title = formatDate(month, options.yearTitleFormat);
            scope.showLabels = false;
            scope.rows = split(months, this.split);
            this.built = true;
          },
          isSelected: function(date) {
            return picker.$date && date.getFullYear() === picker.$date.getFullYear() && date.getMonth() === picker.$date.getMonth();
          },
          isDisabled: function(date) {
            var lastDate = +new Date(date.getFullYear(), date.getMonth() + 1, 0);
            return lastDate < options.minDate || date.getTime() > options.maxDate;
          },
          onKeyDown: function(evt) {
            if (!picker.$date) {
              return;
            }
            var actualMonth = picker.$date.getMonth();
            var newDate = new Date(picker.$date);
            if (evt.keyCode === 37) newDate.setMonth(actualMonth - 1); else if (evt.keyCode === 38) newDate.setMonth(actualMonth - 4); else if (evt.keyCode === 39) newDate.setMonth(actualMonth + 1); else if (evt.keyCode === 40) newDate.setMonth(actualMonth + 4);
            if (!this.isDisabled(newDate)) picker.select(newDate, true);
          }
        }, {
          name: 'year',
          format: options.yearFormat,
          split: 4,
          steps: {
            year: 12
          },
          update: function(date, force) {
            if (!this.built || force || parseInt(date.getFullYear() / 20, 10) !== parseInt(viewDate.year / 20, 10)) {
              angular.extend(viewDate, {
                year: picker.$date.getFullYear(),
                month: picker.$date.getMonth(),
                date: picker.$date.getDate()
              });
              picker.$build();
            } else if (date.getFullYear() !== viewDate.year) {
              angular.extend(viewDate, {
                year: picker.$date.getFullYear(),
                month: picker.$date.getMonth(),
                date: picker.$date.getDate()
              });
              picker.$updateSelected();
            }
          },
          build: function() {
            var firstYear = viewDate.year - viewDate.year % (this.split * 3);
            var years = [];
            var year;
            for (var i = 0; i < 12; i++) {
              year = new Date(firstYear + i, 0, 1);
              years.push({
                date: year,
                label: formatDate(year, this.format),
                selected: picker.$isSelected(year),
                disabled: this.isDisabled(year)
              });
            }
            scope.title = years[0].label + '-' + years[years.length - 1].label;
            scope.showLabels = false;
            scope.rows = split(years, this.split);
            this.built = true;
          },
          isSelected: function(date) {
            return picker.$date && date.getFullYear() === picker.$date.getFullYear();
          },
          isDisabled: function(date) {
            var lastDate = +new Date(date.getFullYear() + 1, 0, 0);
            return lastDate < options.minDate || date.getTime() > options.maxDate;
          },
          onKeyDown: function(evt) {
            if (!picker.$date) {
              return;
            }
            var actualYear = picker.$date.getFullYear();
            var newDate = new Date(picker.$date);
            if (evt.keyCode === 37) newDate.setYear(actualYear - 1); else if (evt.keyCode === 38) newDate.setYear(actualYear - 4); else if (evt.keyCode === 39) newDate.setYear(actualYear + 1); else if (evt.keyCode === 40) newDate.setYear(actualYear + 4);
            if (!this.isDisabled(newDate)) picker.select(newDate, true);
          }
        } ];
        return {
          views: options.minView ? Array.prototype.slice.call(views, options.minView) : views,
          viewDate: viewDate
        };
      };
    } ];
  });
  angular.module('mgcrea.ngStrap.collapse', []).provider('$collapse', function() {
    var defaults = this.defaults = {
      animation: 'am-collapse',
      disallowToggle: false,
      activeClass: 'in',
      startCollapsed: false,
      allowMultiple: false
    };
    var controller = this.controller = function($scope, $element, $attrs) {
      var self = this;
      self.$options = angular.copy(defaults);
      angular.forEach([ 'animation', 'disallowToggle', 'activeClass', 'startCollapsed', 'allowMultiple' ], function(key) {
        if (angular.isDefined($attrs[key])) self.$options[key] = $attrs[key];
      });
      var falseValueRegExp = /^(false|0|)$/i;
      angular.forEach([ 'disallowToggle', 'startCollapsed', 'allowMultiple' ], function(key) {
        if (angular.isDefined($attrs[key]) && falseValueRegExp.test($attrs[key])) {
          self.$options[key] = false;
        }
      });
      self.$toggles = [];
      self.$targets = [];
      self.$viewChangeListeners = [];
      self.$registerToggle = function(element) {
        self.$toggles.push(element);
      };
      self.$registerTarget = function(element) {
        self.$targets.push(element);
      };
      self.$unregisterToggle = function(element) {
        var index = self.$toggles.indexOf(element);
        self.$toggles.splice(index, 1);
      };
      self.$unregisterTarget = function(element) {
        var index = self.$targets.indexOf(element);
        self.$targets.splice(index, 1);
        if (self.$options.allowMultiple) {
          deactivateItem(element);
        }
        fixActiveItemIndexes(index);
        self.$viewChangeListeners.forEach(function(fn) {
          fn();
        });
      };
      self.$targets.$active = !self.$options.startCollapsed ? [ 0 ] : [];
      self.$setActive = $scope.$setActive = function(value) {
        if (angular.isArray(value)) {
          self.$targets.$active = value;
        } else if (!self.$options.disallowToggle && isActive(value)) {
          deactivateItem(value);
        } else {
          activateItem(value);
        }
        self.$viewChangeListeners.forEach(function(fn) {
          fn();
        });
      };
      self.$activeIndexes = function() {
        if (self.$options.allowMultiple) {
          return self.$targets.$active;
        }
        return self.$targets.$active.length === 1 ? self.$targets.$active[0] : -1;
      };
      function fixActiveItemIndexes(index) {
        var activeIndexes = self.$targets.$active;
        for (var i = 0; i < activeIndexes.length; i++) {
          if (index < activeIndexes[i]) {
            activeIndexes[i] = activeIndexes[i] - 1;
          }
          if (activeIndexes[i] === self.$targets.length) {
            activeIndexes[i] = self.$targets.length - 1;
          }
        }
      }
      function isActive(value) {
        var activeItems = self.$targets.$active;
        return activeItems.indexOf(value) !== -1;
      }
      function deactivateItem(value) {
        var index = self.$targets.$active.indexOf(value);
        if (index !== -1) {
          self.$targets.$active.splice(index, 1);
        }
      }
      function activateItem(value) {
        if (!self.$options.allowMultiple) {
          self.$targets.$active.splice(0, 1);
        }
        if (self.$targets.$active.indexOf(value) === -1) {
          self.$targets.$active.push(value);
        }
      }
    };
    this.$get = function() {
      var $collapse = {};
      $collapse.defaults = defaults;
      $collapse.controller = controller;
      return $collapse;
    };
  }).directive('bsCollapse', [ '$window', '$animate', '$collapse', function($window, $animate, $collapse) {
    return {
      require: [ '?ngModel', 'bsCollapse' ],
      controller: [ '$scope', '$element', '$attrs', $collapse.controller ],
      link: function postLink(scope, element, attrs, controllers) {
        var ngModelCtrl = controllers[0];
        var bsCollapseCtrl = controllers[1];
        if (ngModelCtrl) {
          bsCollapseCtrl.$viewChangeListeners.push(function() {
            ngModelCtrl.$setViewValue(bsCollapseCtrl.$activeIndexes());
          });
          ngModelCtrl.$formatters.push(function(modelValue) {
            if (angular.isArray(modelValue)) {
              bsCollapseCtrl.$setActive(modelValue);
            } else {
              var activeIndexes = bsCollapseCtrl.$activeIndexes();
              if (angular.isArray(activeIndexes)) {
                if (activeIndexes.indexOf(modelValue * 1) === -1) {
                  bsCollapseCtrl.$setActive(modelValue * 1);
                }
              } else if (activeIndexes !== modelValue * 1) {
                bsCollapseCtrl.$setActive(modelValue * 1);
              }
            }
            return modelValue;
          });
        }
      }
    };
  } ]).directive('bsCollapseToggle', function() {
    return {
      require: [ '^?ngModel', '^bsCollapse' ],
      link: function postLink(scope, element, attrs, controllers) {
        var bsCollapseCtrl = controllers[1];
        element.attr('data-toggle', 'collapse');
        bsCollapseCtrl.$registerToggle(element);
        scope.$on('$destroy', function() {
          bsCollapseCtrl.$unregisterToggle(element);
        });
        element.on('click', function() {
          if (!attrs.disabled) {
            var index = attrs.bsCollapseToggle && attrs.bsCollapseToggle !== 'bs-collapse-toggle' ? attrs.bsCollapseToggle : bsCollapseCtrl.$toggles.indexOf(element);
            bsCollapseCtrl.$setActive(index * 1);
            scope.$apply();
          }
        });
      }
    };
  }).directive('bsCollapseTarget', [ '$animate', function($animate) {
    return {
      require: [ '^?ngModel', '^bsCollapse' ],
      link: function postLink(scope, element, attrs, controllers) {
        var bsCollapseCtrl = controllers[1];
        element.addClass('collapse');
        if (bsCollapseCtrl.$options.animation) {
          element.addClass(bsCollapseCtrl.$options.animation);
        }
        bsCollapseCtrl.$registerTarget(element);
        scope.$on('$destroy', function() {
          bsCollapseCtrl.$unregisterTarget(element);
        });
        function render() {
          var index = bsCollapseCtrl.$targets.indexOf(element);
          var active = bsCollapseCtrl.$activeIndexes();
          var action = 'removeClass';
          if (angular.isArray(active)) {
            if (active.indexOf(index) !== -1) {
              action = 'addClass';
            }
          } else if (index === active) {
            action = 'addClass';
          }
          $animate[action](element, bsCollapseCtrl.$options.activeClass);
        }
        bsCollapseCtrl.$viewChangeListeners.push(function() {
          render();
        });
        render();
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.aside', [ 'mgcrea.ngStrap.modal' ]).provider('$aside', function() {
    var defaults = this.defaults = {
      animation: 'am-fade-and-slide-right',
      prefixClass: 'aside',
      prefixEvent: 'aside',
      placement: 'right',
      templateUrl: 'aside/aside.tpl.html',
      contentTemplate: false,
      container: false,
      element: null,
      backdrop: true,
      keyboard: true,
      html: false,
      show: true
    };
    this.$get = [ '$modal', function($modal) {
      function AsideFactory(config) {
        var $aside = {};
        var options = angular.extend({}, defaults, config);
        $aside = $modal(options);
        return $aside;
      }
      return AsideFactory;
    } ];
  }).directive('bsAside', [ '$window', '$sce', '$aside', function($window, $sce, $aside) {
    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr, transclusion) {
        var options = {
          scope: scope,
          element: element,
          show: false
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'contentTemplate', 'placement', 'backdrop', 'keyboard', 'html', 'container', 'animation' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'backdrop', 'keyboard', 'html', 'container' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) options[key] = false;
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        angular.forEach([ 'title', 'content' ], function(key) {
          if (attr[key]) {
            attr.$observe(key, function(newValue, oldValue) {
              scope[key] = $sce.trustAsHtml(newValue);
            });
          }
        });
        if (attr.bsAside) {
          scope.$watch(attr.bsAside, function(newValue, oldValue) {
            if (angular.isObject(newValue)) {
              angular.extend(scope, newValue);
            } else {
              scope.content = newValue;
            }
          }, true);
        }
        var aside = $aside(options);
        element.on(attr.trigger || 'click', aside.toggle);
        scope.$on('$destroy', function() {
          if (aside) aside.destroy();
          options = null;
          aside = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.alert', [ 'mgcrea.ngStrap.modal' ]).provider('$alert', function() {
    var defaults = this.defaults = {
      animation: 'am-fade',
      prefixClass: 'alert',
      prefixEvent: 'alert',
      placement: null,
      templateUrl: 'alert/alert.tpl.html',
      container: false,
      element: null,
      backdrop: false,
      keyboard: true,
      show: true,
      duration: false,
      type: false,
      dismissable: true
    };
    this.$get = [ '$modal', '$timeout', function($modal, $timeout) {
      function AlertFactory(config) {
        var $alert = {};
        var options = angular.extend({}, defaults, config);
        $alert = $modal(options);
        $alert.$scope.dismissable = !!options.dismissable;
        if (options.type) {
          $alert.$scope.type = options.type;
        }
        var show = $alert.show;
        if (options.duration) {
          $alert.show = function() {
            show();
            $timeout(function() {
              $alert.hide();
            }, options.duration * 1e3);
          };
        }
        return $alert;
      }
      return AlertFactory;
    } ];
  }).directive('bsAlert', [ '$window', '$sce', '$alert', function($window, $sce, $alert) {
    return {
      restrict: 'EAC',
      scope: true,
      link: function postLink(scope, element, attr, transclusion) {
        var options = {
          scope: scope,
          element: element,
          show: false
        };
        angular.forEach([ 'template', 'templateUrl', 'controller', 'controllerAs', 'placement', 'keyboard', 'html', 'container', 'animation', 'duration', 'dismissable' ], function(key) {
          if (angular.isDefined(attr[key])) options[key] = attr[key];
        });
        var falseValueRegExp = /^(false|0|)$/i;
        angular.forEach([ 'keyboard', 'html', 'container', 'dismissable' ], function(key) {
          if (angular.isDefined(attr[key]) && falseValueRegExp.test(attr[key])) options[key] = false;
        });
        angular.forEach([ 'onBeforeShow', 'onShow', 'onBeforeHide', 'onHide' ], function(key) {
          var bsKey = 'bs' + key.charAt(0).toUpperCase() + key.slice(1);
          if (angular.isDefined(attr[bsKey])) {
            options[key] = scope.$eval(attr[bsKey]);
          }
        });
        if (!scope.hasOwnProperty('title')) {
          scope.title = '';
        }
        angular.forEach([ 'title', 'content', 'type' ], function(key) {
          if (attr[key]) {
            attr.$observe(key, function(newValue, oldValue) {
              scope[key] = $sce.trustAsHtml(newValue);
            });
          }
        });
        if (attr.bsAlert) {
          scope.$watch(attr.bsAlert, function(newValue, oldValue) {
            if (angular.isObject(newValue)) {
              angular.extend(scope, newValue);
            } else {
              scope.content = newValue;
            }
          }, true);
        }
        var alert = $alert(options);
        element.on(attr.trigger || 'click', alert.toggle);
        scope.$on('$destroy', function() {
          if (alert) alert.destroy();
          options = null;
          alert = null;
        });
      }
    };
  } ]);
  angular.module('mgcrea.ngStrap.affix', [ 'mgcrea.ngStrap.helpers.dimensions', 'mgcrea.ngStrap.helpers.debounce' ]).provider('$affix', function() {
    var defaults = this.defaults = {
      offsetTop: 'auto',
      inlineStyles: true,
      setWidth: true
    };
    this.$get = [ '$window', 'debounce', 'dimensions', function($window, debounce, dimensions) {
      var bodyEl = angular.element($window.document.body);
      var windowEl = angular.element($window);
      function AffixFactory(element, config) {
        var $affix = {};
        var options = angular.extend({}, defaults, config);
        var targetEl = options.target;
        var reset = 'affix affix-top affix-bottom';
        var setWidth = false;
        var initialAffixTop = 0;
        var initialOffsetTop = 0;
        var offsetTop = 0;
        var offsetBottom = 0;
        var affixed = null;
        var unpin = null;
        var parent = element.parent();
        if (options.offsetParent) {
          if (options.offsetParent.match(/^\d+$/)) {
            for (var i = 0; i < options.offsetParent * 1 - 1; i++) {
              parent = parent.parent();
            }
          } else {
            parent = angular.element(options.offsetParent);
          }
        }
        $affix.init = function() {
          this.$parseOffsets();
          initialOffsetTop = dimensions.offset(element[0]).top + initialAffixTop;
          setWidth = options.setWidth && !element[0].style.width;
          targetEl.on('scroll', this.checkPosition);
          targetEl.on('click', this.checkPositionWithEventLoop);
          windowEl.on('resize', this.$debouncedOnResize);
          this.checkPosition();
          this.checkPositionWithEventLoop();
        };
        $affix.destroy = function() {
          targetEl.off('scroll', this.checkPosition);
          targetEl.off('click', this.checkPositionWithEventLoop);
          windowEl.off('resize', this.$debouncedOnResize);
        };
        $affix.checkPositionWithEventLoop = function() {
          setTimeout($affix.checkPosition, 1);
        };
        $affix.checkPosition = function() {
          var scrollTop = getScrollTop();
          var position = dimensions.offset(element[0]);
          var elementHeight = dimensions.height(element[0]);
          var affix = getRequiredAffixClass(unpin, position, elementHeight);
          if (affixed === affix) return;
          affixed = affix;
          if (affix === 'top') {
            unpin = null;
            if (setWidth) {
              element.css('width', '');
            }
            if (options.inlineStyles) {
              element.css('position', options.offsetParent ? '' : 'relative');
              element.css('top', '');
            }
          } else if (affix === 'bottom') {
            if (options.offsetUnpin) {
              unpin = -(options.offsetUnpin * 1);
            } else {
              unpin = position.top - scrollTop;
            }
            if (setWidth) {
              element.css('width', '');
            }
            if (options.inlineStyles) {
              element.css('position', options.offsetParent ? '' : 'relative');
              element.css('top', options.offsetParent ? '' : bodyEl[0].offsetHeight - offsetBottom - elementHeight - initialOffsetTop + 'px');
            }
          } else {
            unpin = null;
            if (setWidth) {
              element.css('width', element[0].offsetWidth + 'px');
            }
            if (options.inlineStyles) {
              element.css('position', 'fixed');
              element.css('top', initialAffixTop + 'px');
            }
          }
          element.removeClass(reset).addClass('affix' + (affix !== 'middle' ? '-' + affix : ''));
        };
        $affix.$onResize = function() {
          $affix.$parseOffsets();
          $affix.checkPosition();
        };
        $affix.$debouncedOnResize = debounce($affix.$onResize, 50);
        $affix.$parseOffsets = function() {
          var initialPosition = element[0].style.position;
          var initialTop = element[0].style.top;
          if (options.inlineStyles) {
            element.css('position', options.offsetParent ? '' : 'relative');
            element.css('top', '');
          }
          if (options.offsetTop) {
            if (options.offsetTop === 'auto') {
              options.offsetTop = '+0';
            }
            if (options.offsetTop.match(/^[-+]\d+$/)) {
              initialAffixTop = -options.offsetTop * 1;
              if (options.offsetParent) {
                offsetTop = dimensions.offset(parent[0]).top + options.offsetTop * 1;
              } else {
                offsetTop = dimensions.offset(element[0]).top - dimensions.css(element[0], 'marginTop', true) + options.offsetTop * 1;
              }
            } else {
              offsetTop = options.offsetTop * 1;
            }
          }
          if (options.offsetBottom) {
            if (options.offsetParent && options.offsetBottom.match(/^[-+]\d+$/)) {
              offsetBottom = getScrollHeight() - (dimensions.offset(parent[0]).top + dimensions.height(parent[0])) + options.offsetBottom * 1 + 1;
            } else {
              offsetBottom = options.offsetBottom * 1;
            }
          }
          if (options.inlineStyles) {
            element.css('position', initialPosition);
            element.css('top', initialTop);
          }
        };
        function getRequiredAffixClass(_unpin, position, elementHeight) {
          var scrollTop = getScrollTop();
          var scrollHeight = getScrollHeight();
          if (scrollTop <= offsetTop) {
            return 'top';
          } else if (_unpin !== null) {
            return scrollTop + _unpin <= position.top ? 'middle' : 'bottom';
          } else if (offsetBottom !== null && position.top + elementHeight + initialAffixTop >= scrollHeight - offsetBottom) {
            return 'bottom';
          }
          return 'middle';
        }
        function getScrollTop() {
          return targetEl[0] === $window ? $window.pageYOffset : targetEl[0].scrollTop;
        }
        function getScrollHeight() {
          return targetEl[0] === $window ? $window.document.body.scrollHeight : targetEl[0].scrollHeight;
        }
        $affix.init();
        return $affix;
      }
      return AffixFactory;
    } ];
  }).directive('bsAffix', [ '$affix', '$window', '$timeout', function($affix, $window, $timeout) {
    return {
      restrict: 'EAC',
      require: '^?bsAffixTarget',
      link: function postLink(scope, element, attr, affixTarget) {
        var options = {
          scope: scope,
          target: affixTarget ? affixTarget.$element : angular.element($window)
        };
        angular.forEach([ 'offsetTop', 'offsetBottom', 'offsetParent', 'offsetUnpin', 'inlineStyles', 'setWidth' ], function(key) {
          if (angular.isDefined(attr[key])) {
            var option = attr[key];
            if (/true/i.test(option)) option = true;
            if (/false/i.test(option)) option = false;
            options[key] = option;
          }
        });
        var affix;
        $timeout(function() {
          affix = $affix(element, options);
        });
        scope.$on('$destroy', function() {
          if (affix) affix.destroy();
          options = null;
          affix = null;
        });
      }
    };
  } ]).directive('bsAffixTarget', function() {
    return {
      controller: [ '$element', function($element) {
        this.$element = $element;
      } ]
    };
  });
  angular.module('mgcrea.ngStrap', [ 'mgcrea.ngStrap.modal', 'mgcrea.ngStrap.aside', 'mgcrea.ngStrap.alert', 'mgcrea.ngStrap.button', 'mgcrea.ngStrap.select', 'mgcrea.ngStrap.datepicker', 'mgcrea.ngStrap.timepicker', 'mgcrea.ngStrap.navbar', 'mgcrea.ngStrap.tooltip', 'mgcrea.ngStrap.popover', 'mgcrea.ngStrap.dropdown', 'mgcrea.ngStrap.typeahead', 'mgcrea.ngStrap.scrollspy', 'mgcrea.ngStrap.affix', 'mgcrea.ngStrap.tab', 'mgcrea.ngStrap.collapse' ]);
})(window, document);