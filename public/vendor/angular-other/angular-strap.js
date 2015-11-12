/**
 * AngularStrap - Twitter Bootstrap directives for AngularJS
 * @version v0.7.5 - 2013-07-21
 * @link http://mgcrea.github.com/angular-strap
 * @author Olivier Louvignes <olivier@mg-crea.com>
 * @license MIT License, http://www.opensource.org/licenses/MIT
 */
angular.module('$strap.config', []).value('$strapConfig', {});
angular.module('$strap.filters', ['$strap.config']);
angular.module('$strap.directives', ['$strap.config']);
angular.module('$strap', [
  '$strap.filters',
  '$strap.directives',
  '$strap.config'
]);
'use strict';
angular.module('$strap.directives').factory('$modal', [
  '$rootScope',
  '$compile',
  '$http',
  '$timeout',
  '$q',
  '$templateCache',
  '$strapConfig',
  function ($rootScope, $compile, $http, $timeout, $q, $templateCache, $strapConfig) {
    var ModalFactory = function ModalFactory(config) {
      function Modal(config) {
        var options = angular.extend({ show: true }, $strapConfig.modal, config), scope = options.scope ? options.scope : $rootScope.$new(), templateUrl = options.template;
        return $q.when($templateCache.get(templateUrl) || $http.get(templateUrl, { cache: true }).then(function (res) {
          return res.data;
        })).then(function onSuccess(template) {
          var id = templateUrl.replace('.html', '').replace(/[\/|\.|:]/g, '-') + '-' + scope.$id;
          // grafana change, removed fade
          var $modal = $('<div class="modal hide" tabindex="-1"></div>').attr('id', id).html(template);
          if (options.modalClass)
            $modal.addClass(options.modalClass);
          $('body').append($modal);
          $timeout(function () {
            $compile($modal)(scope);
          });
          scope.$modal = function (name) {
            $modal.modal(name);
          };
          angular.forEach([
            'show',
            'hide'
          ], function (name) {
            scope[name] = function () {
              $modal.modal(name);
            };
          });
          scope.dismiss = scope.hide;
          angular.forEach([
            'show',
            'shown',
            'hide',
            'hidden'
          ], function (name) {
            $modal.on(name, function (ev) {
              scope.$emit('modal-' + name, ev);
            });
          });
          $modal.on('shown', function (ev) {
            $('input[autofocus], textarea[autofocus]', $modal).first().trigger('focus');
          });
          $modal.on('hidden', function (ev) {
            if (!options.persist)
              scope.$destroy();
          });
          scope.$on('$destroy', function () {
            $modal.remove();
          });
          $modal.modal(options);
          return $modal;
        });
      }
      return new Modal(config);
    };
    return ModalFactory;
  }
])
'use strict';
angular.module('$strap.directives').directive('bsTabs', [
  '$parse',
  '$compile',
  '$timeout',
  function ($parse, $compile, $timeout) {
    var template = '<div class="tabs">' + '<ul class="nav nav-tabs">' + '<li ng-repeat="pane in panes" ng-class="{active:pane.active}">' + '<a data-target="#{{pane.id}}" data-index="{{$index}}" data-toggle="tab">{{pane.title}}</a>' + '</li>' + '</ul>' + '<div class="tab-content" ng-transclude>' + '</div>';
    return {
      restrict: 'A',
      require: '?ngModel',
      priority: 0,
      scope: true,
      template: template,
      replace: true,
      transclude: true,
      compile: function compile(tElement, tAttrs, transclude) {
        return function postLink(scope, iElement, iAttrs, controller) {
          var getter = $parse(iAttrs.bsTabs), setter = getter.assign, value = getter(scope);
          scope.panes = [];
          var $tabs = iElement.find('ul.nav-tabs');
          var $panes = iElement.find('div.tab-content');
          var activeTab = 0, id, title, active;
          $timeout(function () {
            $panes.find('[data-title], [data-tab]').each(function (index) {
              var $this = angular.element(this);
              id = 'tab-' + scope.$id + '-' + index;
              title = $this.data('title') || $this.data('tab');
              active = !active && $this.hasClass('active');
              $this.attr('id', id).addClass('tab-pane');
              if (iAttrs.fade)
                $this.addClass('fade');
              scope.panes.push({
                id: id,
                title: title,
                content: this.innerHTML,
                active: active
              });
            });
            if (scope.panes.length && !active) {
              $panes.find('.tab-pane:first-child').addClass('active' + (iAttrs.fade ? ' in' : ''));
              scope.panes[0].active = true;
            }
          });
          if (controller) {
            iElement.on('show', function (ev) {
              var $target = $(ev.target);
              scope.$apply(function () {
                controller.$setViewValue($target.data('index'));
              });
            });
            scope.$watch(iAttrs.ngModel, function (newValue, oldValue) {
              if (angular.isUndefined(newValue))
                return;
              activeTab = newValue;
              setTimeout(function () {
                // Check if we're still on the same tab before making the switch
                if(activeTab === newValue) {
                  var $next = $($tabs[0].querySelectorAll('li')[newValue * 1]);
                  if (!$next.hasClass('active')) {
                    $next.children('a').tab('show');
                  }
                }
              });
            });
          }
        };
      }
    };
  }
]);
'use strict';
angular.module('$strap.directives').directive('bsTooltip', [
  '$parse',
  '$compile',
  function ($parse, $compile) {
    return {
      restrict: 'A',
      scope: true,
      link: function postLink(scope, element, attrs, ctrl) {
        var getter = $parse(attrs.bsTooltip), setter = getter.assign, value = getter(scope);
        scope.$watch(attrs.bsTooltip, function (newValue, oldValue) {
          if (newValue !== oldValue) {
            value = newValue;
          }
        });
        // Grafana change, always hide other tooltips
        if (true) {
          element.on('show', function (ev) {
            $('.tooltip.in').each(function () {
              var $this = $(this), tooltip = $this.data('tooltip');
              if (tooltip && !tooltip.$element.is(element)) {
                $this.tooltip('hide');
              }
            });
          });
        }
        element.tooltip({
          title: function () {
            return angular.isFunction(value) ? value.apply(null, arguments) : value;
          },
          html: true,
          container: 'body', // Grafana change
        });
        var tooltip = element.data('tooltip');
        tooltip.show = function () {
          var r = $.fn.tooltip.Constructor.prototype.show.apply(this, arguments);
          this.tip().data('tooltip', this);
          return r;
        };
        scope._tooltip = function (event) {
          element.tooltip(event);
        };
        scope.hide = function () {
          element.tooltip('hide');
        };
        scope.show = function () {
          element.tooltip('show');
        };
        scope.dismiss = scope.hide;
      }
    };
  }
]);
'use strict';
angular.module('$strap.directives').directive('bsTypeahead', [
  '$parse',
  function ($parse) {
    return {
      restrict: 'A',
      require: '?ngModel',
      link: function postLink(scope, element, attrs, controller) {
        var getter = $parse(attrs.bsTypeahead), setter = getter.assign, value = getter(scope);
        scope.$watch(attrs.bsTypeahead, function (newValue, oldValue) {
          if (newValue !== oldValue) {
            value = newValue;
          }
        });
        element.attr('data-provide', 'typeahead');
        element.typeahead({
          source: function (query) {
            return angular.isFunction(value) ? value.apply(null, arguments) : value;
          },
          minLength: attrs.minLength || 1,
          items: attrs.items,
          updater: function (value) {
            if (controller) {
              scope.$apply(function () {
                controller.$setViewValue(value);
              });
            }
            scope.$emit('typeahead-updated', value);
            return value;
          }
        });
        var typeahead = element.data('typeahead');
        typeahead.lookup = function (ev) {
          var items;
          this.query = this.$element.val() || '';
          if (this.query.length < this.options.minLength) {
            return this.shown ? this.hide() : this;
          }
          items = $.isFunction(this.source) ? this.source(this.query, $.proxy(this.process, this)) : this.source;
          return items ? this.process(items) : this;
        };
        if (!!attrs.matchAll) {
          typeahead.matcher = function (item) {
            return true;
          };
        }
        if (attrs.minLength === '0') {
          setTimeout(function () {
            element.on('focus', function () {
              element.val().length === 0 && setTimeout(element.typeahead.bind(element, 'lookup'), 200);
            });
          });
        }
      }
    };
  }
]);
