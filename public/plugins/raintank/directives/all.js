define([
  'angular',
  'lodash',
  'jquery'
], function (angular, _, $) {
  var module = angular.module('grafana.directives');

  module.directive('raintankSetting', function ($compile) {
    return {
      transclude: true,
      restrict: 'E',
      scope: {
        definition: '=',
        target: '='
      },
      template: '<div></div>',
      replace: true,
      link: function(scope,element, attrs) {
        var tmpl;
        if (!scope.target.value && scope.target.value !== 0 && scope.target.value !== false) {
          scope.target.value = scope.definition.default_value;
        }

        switch (scope.definition.data_type) {
          case 'String':
            tmpl = '<label class="small">{{definition.description}}</label>';
            tmpl += '<input type="text" placeholder="{{definition.description}}" ng-required="definition.required" ng-model="target.value" class="rt-form-input form-control">';
            break;
          case 'Text':
            tmpl = '<label class="small">{{definition.description}}</label>';
            tmpl += '<textarea placeholder="{{definition.description}}" ng-required="definition.required" ng-model="target.value" class="rt-form-input form-control">';
            break;
          case 'Number':
            tmpl = '<label class="small">{{definition.description}}</label>';
            scope.target.value = parseFloat(scope.target.value).toString();
            tmpl += '<input type="text" placeholder="{{definition.description}}" ng-required="definition.required" ng-model="target.value" class="rt-form-input form-control">';
            break;
          case 'Boolean':
            scope.id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
              var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
              return v.toString(16);
            });
            tmpl = '<input type="checkbox" ng-true-value="\'true\'" id={{id}} ng-false-value="\'false\'" ng-model="target.value" class="rt-modal">';
            tmpl += '<label class="rt-modal rt-modal-label-copy" for="{{id}}">{{definition.description}}</label>';
            break;
          case 'Enum':
            tmpl = '<label class="small">{{definition.description}}</label>';
            tmpl += '<select ng-model="target.value" class="rt-form-input form-control" ng-options="e for e in definition.conditions.values" ng-required="definition.required" style="height: 34px;">';
            break;
          default:
            tmpl = '<label class="small">{{definition.description}}</label>';
            tmpl += '<input type="text" placeholder="{{definition.description}} : {{definition.data_type}}" ng-required="definition.required" ng-model="target.value" class="rt-form-input form-control">';
        }

        element.html(tmpl);
        $compile(element.contents())(scope);
      }
    };
  });

  module.directive("rtCheckHealth", function($compile) {
    return {
      templateUrl: 'plugins/raintank/directives/partials/checkHealth.html',
      scope: {
        model: "=",
      },
      link: function(scope, element) {
        scope.$watch("model", function(health) {
          if (typeof(health) == "object") {
            showHealth(health);
          }
        });

        function showHealth(health) {
          var tmpl = '';
          var okCount = 0;
          var warnCount = 0;
          var errorCount = 0;
          var unknownCount = 0;
          _.forEach(health, function(checkState) {
            if (checkState.state == -1) {
              unknownCount++;
              return
            }
            if (checkState.state == 0) {
              okCount++;
              return
            }
            if (checkState.state == 1) {
              warnCount++;
              return
            }
            if (checkState.state == 2) {
              errorCount++;
              return
            }
          });
          scope.okCount = okCount;
          scope.warnCount = warnCount;
          scope.errorCount = errorCount;
          scope.unknownCount = unknownCount;
        }
      }
    };
  });

  module.directive("rtEndpointHealth", function() {
    return {
      templateUrl: 'plugins/raintank/directives/partials/endpointHealth.html',
      scope: false,
    };
  });

  module.directive("rtCollectorHealth", function(backendSrv) {
    return {
      templateUrl: 'plugins/raintank/directives/partials/collectorHealth.html',
      scope: {
        model: "=",
      },
      link: function(scope, element) {
        scope.$watch("model", function(model) {
          if (typeof(model) == "object") {
            showHealth(model);
          }
        });

        function showHealth(model) {
          backendSrv.get('/api/collectors/'+model.id+'/health').then(function(health) {
            var tmpl = '';
            var okCount = 0;
            var warnCount = 0;
            var errorCount = 0;
            var unknownCount = 0;
            _.forEach(health, function(checkState) {
              if (checkState.state == -1) {
                unknownCount++;
                return
              }
              if (checkState.state == 0) {
                okCount++;
                return
              }
              if (checkState.state == 1) {
                warnCount++;
                return
              }
              if (checkState.state == 2) {
                errorCount++;
                return
              }
            });
            scope.okCount = okCount;
            scope.warnCount = warnCount;
            scope.errorCount = errorCount;
            scope.unknownCount = unknownCount;
          });
        }
      }
    };
  });

  module.directive("rtCollectorSummaryHealth", function(backendSrv) {
    return {
      templateUrl: 'plugins/raintank/directives/partials/collectorSummaryHealth.html',
      scope: {
        model: "=",
      },
      link: function(scope, element) {
        scope.$watch("model", function(model) {
          if (typeof(model) == "object") {
            showHealth(model);
          }
        });

        function showHealth(model) {
          backendSrv.get('/api/collectors/'+model.id+'/health').then(function(health) {
            var tmpl = '';
            var okCount = 0;
            var warnCount = 0;
            var errorCount = 0;
            var unknownCount = 0;
            _.forEach(health, function(checkState) {
              if (checkState.state == -1) {
                unknownCount++;
                return
              }
              if (checkState.state == 0) {
                okCount++;
                return
              }
              if (checkState.state == 1) {
                warnCount++;
                return
              }
              if (checkState.state == 2) {
                errorCount++;
                return
              }
            });
            scope.okCount = okCount;
            scope.warnCount = warnCount;
            scope.errorCount = errorCount;
            scope.unknownCount = unknownCount;
          });
        }
      }
    };
  });

  module.directive('panelScroll', function() {
    function getPanelHeight(scope) {
      if (scope.fullscreen) {
        return "80%";
      }
      var height = scope.height || scope.panel.height || scope.row.height;
      var panel_height = parseInt(height.replace(/\D+/g, ''));
      return  (panel_height - 30) + 'px';
    }

    return function(scope, element) {
      element[0].style.overflow = 'auto';
      scope.$watchGroup(['fullscreen', 'height', 'panel.height', 'row.height'], function(newVal) {
        element[0].style.height = getPanelHeight(scope);
      });
    };
  });

  module.directive('endpointCollectorSelect', function($compile, $window, $timeout) {
    return {
      scope: {
        collectors: "=",
        model: "=",
      },
      templateUrl: 'plugins/raintank/directives/partials/endpointCollectorSelect.html',
      link: function(scope, elem) {
        var bodyEl = angular.element($window.document.body);
        scope.show = function() {
          scope.selectorOpen = true;
          scope.giveFocus = 1;

          var currentIds = scope.model.collector_ids;
          var currentTags = scope.model.collector_tags;

          var seenTags = {};
          scope.options = [];
          scope.tags = [];
          _.forEach(scope.collectors, function(c) {
            var option = {id: c.id, selected: false, text: c.name};
            if (_.indexOf(currentIds, c.id) >= 0) {
              option.selected = true;
            }
            _.forEach(c.tags, function(t) {
              if (!(t in seenTags)) {
                seenTags[t] = true;
                var o = {selected: false, text: t};
                if (_.indexOf(currentTags, t) >= 0) {
                  o.selected = true;
                }
                scope.tags.push(o);
              }
            });
            scope.options.push(option);
          });

          $timeout(function() {
            bodyEl.on('click', scope.bodyOnClick);
          }, 0, false);
        };

        scope.optionSelected = function(option) {
          option.selected = !option.selected;

          var selectedIds = _.filter(scope.options, {selected: true});
          var selectedTags = _.filter(scope.tags, {selected: true});

          // enfore the first selected if no option is selected
          if (selectedIds.length === 0 && selectedTags.length === 0) {
            scope.options[0].selected = true;
            selectedIds = [scope.options[0]];
          }

          scope.model.collector_ids = [];
          _.forEach(selectedIds, function(c) {
            scope.model.collector_ids.push(c.id);
          });
        };
        scope.selectAll = function() {
          var select = true;
          var selectedIds = _.filter(scope.options, {selected: true});
          var selectedTags = _.filter(scope.tags, {selected: true});
          if (selectedIds.length == scope.options.length) {
            select = false;
          }
          _.forEach(scope.options, function(option) {
            option.selected = select;
          });

          // enfore the first selected if no option is selected
          if (!select && selectedTags.length === 0) {
            scope.options[0].selected = true;
            selectedIds = [scope.options[0]];
          }

          scope.model.collector_ids = [];
          _.forEach(selectedIds, function(c) {
            scope.model.collector_ids.push(c.id);
          });
        }

        scope.tagSelected = function(option) {
          option.selected = !option.selected;

          var selectedIds = _.filter(scope.options, {selected: true});
          var selectedTags = _.filter(scope.tags, {selected: true});

          // enfore the first selected if no option is selected
          if (selectedIds.length === 0 && selectedTags.length === 0) {
            scope.options[0].selected = true;
            scope.model.collector_ids = [scope.options[0].id];
          }

          scope.model.collector_tags = [];
          _.forEach(selectedTags, function(t) {
            scope.model.collector_tags.push(t.text);
          });
        };

        scope.hide = function() {
          scope.selectorOpen = false;
          bodyEl.off('click', scope.bodyOnClick);
        };

        scope.bodyOnClick = function(e) {
          var dropdown = elem.find('.variable-value-dropdown');
          if (dropdown.has(e.target).length === 0) {
            scope.$apply(scope.hide);
          }
        };

      },
    };
  });

});
