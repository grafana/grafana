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

  module.directive("rtCheckHealth", function($compile, datasourceSrv) {
    return {
      templateUrl: 'plugins/raintank/directives/partials/checkHealth.html',
      scope: {
        model: "=",
      },
      link: function(scope, element) {

        scope.$watch("model", function(monitor) {
          if (typeof(monitor) == "object") {
            var metricsQuery = {
              range: {from: "now-"+ (monitor.frequency + 30) + 's', to: "now"},
              interval: monitor.frequency + 's',
              targets: [
                {target: monitor.endpoint_slug + ".*.network."+monitor.monitor_type_name.toLowerCase()+".{ok_state,warn_state,error_state}"}
              ],
              format: 'json',
              maxDataPoints: 10,
            };

            var datasource = datasourceSrv.get('raintank');
            datasource.then(function(ds) {
              ds.query(metricsQuery).then(function(results) {
                showHealth(results);
              });
            });
          }
        });

        function showHealth(metrics) {
          var tmpl = '';
          var okCount = 0;
          var warnCount = 0;
          var errorCount = 0;
          var unknownCount = 0;
          var collectorResults = {};
          _.forEach(metrics.data, function(result) {
            var parts = result.target.split('.')
            var stateStr = parts[4];
            var collector = parts[1];
            var check = parts[3];
            if (!(collector in collectorResults)) {
              collectorResults[collector] = {ts: -1, state: -1};
            }

            //start with the last point and work backwards till we find a non-null value.
            for (var i = result.datapoints.length - 1 ; i >= 0; i--) {
              var point = result.datapoints[i];
              if (!isNaN(point[0])) {
                if ((point[0] == 1) && (point[1] > collectorResults[collector].ts)) {
                  collectorResults[collector].ts = point[1];
                  switch (stateStr) {
                    case 'ok_state':
                      collectorResults[collector].state = 0
                      break;
                    case 'warn_state':
                      collectorResults[collector].state = 1
                      break
                    case 'error_state':
                      collectorResults[collector].state = 2
                      break
                    default:
                      collectorResults[collector].state = -1
                      console.log("unknown state returned. this shouldnt happen :(");
                  }
                  break;
                }
              }
            }
          });
          for (col in collectorResults) {
            switch (collectorResults[col].state) {
              case 0:
                okCount++;
                break;
              case 1:
                warnCount++;
                break;
              case 2:
                errorCount++;
                break;
              default:
                unknownCount++;
            }
          }
          var unknowns = scope.model.collectors - Object.keys(collectorResults).length;
          unknownCount += unknowns;

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
        var currentIds = scope.model.collector_ids;
        var currentTags = scope.model.collector_tags;
        scope.init = function() {
          currentIds = scope.model.collector_ids;
          currentTags = scope.model.collector_tags;
          scope.footprint = {value: "static"};
          scope.error = false;

          // determine if we are using static or dynamic allocation.
          if (currentIds.length > 0) {
            scope.footprint.value = 'static';
            _.forEach(scope.tags, function(t) {
              t.selected = false;
            });
          } else if (currentTags.length > 0) {
            scope.footprint.value = 'dynamic';
            _.forEach(scope.ids, function(i) {
              i.selected = false;
            });
          }
          scope.reset();
        }

        scope.reset = function() {
          scope.error = false;
          scope.ids = [];
          scope.tags = [];
          //build out our list of collectorIds and tags
          var seenTags = {};
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
            scope.ids.push(option);
          });
          if (scope.footprint.value == 'dynamic') {
            _.forEach(scope.ids, function(i) {
              i.selected = false;
            });
          } else {
            _.forEach(scope.tags, function(t) {
              t.selected = false;
            });
          }
        }

        scope.show = function() {
          scope.reset();
          scope.selectorOpen = true;
          scope.giveFocus = 1;

          $timeout(function() {
            bodyEl.on('click', scope.bodyOnClick);
          }, 0, false);
        };

        scope.idSelected = function(option) {
          option.selected = !option.selected;
          var selectedIds = _.filter(scope.ids, {selected: true});
        };

        scope.selectAll = function() {
          var select = true;
          var selectedIds = _.filter(scope.ids, {selected: true});

          if (selectedIds.length == scope.ids.length) {
            select = false;
          }
          _.forEach(scope.ids, function(option) {
            option.selected = select;
          });
        }

        scope.tagSelected = function(option) {
          option.selected = !option.selected;

          var selectedTags = _.filter(scope.tags, {selected: true});
        };

        scope.collectorsWithTags = function() {
          var collectorList = {};
          _.forEach(scope.collectors, function(c) {
            _.forEach(_.filter(scope.tags, {selected: true}), function(t) {
              if (_.indexOf(c.tags, t.text) != -1) {
                collectorList[c.name] = true;
              }
            });
          });
          return Object.keys(collectorList).join(', ');
        };

        scope.collectorCount = function(tag) {
          var count = 0;
          _.forEach(scope.collectors, function(c) {
            if (_.indexOf(c.tags, tag.text) != -1) {
              count++;
            }
          });
          return count;
        }

        scope.selectTagTitle = function() {
          var selectedTags = _.filter(scope.tags, {selected: true});
          if (selectedTags.length <= 2) {
            return _.pluck(selectedTags, 'text').join(", ");
          }
          return _.pluck(selectedTags, 'text').slice(0, 2).join(", ") + " and " + (selectedTags.length - 2) + " more";
        };

        scope.selectIdTitle = function() {
          var selectedIds = _.filter(scope.ids, {selected: true});
          if (selectedIds.length <= 2) {
            return _.pluck(selectedIds, 'text').join(", ");
          }
          return _.pluck(selectedIds, 'text').slice(0, 2).join(", ") + " and " + (selectedIds.length - 2) + " more";
        };

        scope.hide = function() {
          var lastFootprint = scope.footprint.value;
          // determine if we are using static or dynamic allocation.
          if (scope.model.collector_ids.length > 0) {
            scope.footprint.value = 'static';
            _.forEach(scope.tags, function(t) {
              t.selected = false;
            });
          } else if (scope.model.collector_tags.length > 0) {
            scope.footprint.value = 'dynamic';
            _.forEach(scope.ids, function(i) {
              i.selected = false;
            });
          }
          scope.reset();
          scope.selectorOpen = false;
          bodyEl.off('click', scope.bodyOnClick);
        };

        scope.bodyOnClick = function(e) {
          var dropdown = elem.find('.variable-value-dropdown');
          if (dropdown.has(e.target).length === 0) {
            scope.$apply(scope.hide);
          }
        };

        scope.cancel = function() {
          scope.hide();
        }

        scope.update = function() {
          var selectedIds = _.filter(scope.ids, {selected: true});
          var selectedTags = _.filter(scope.tags, {selected: true});
          if (selectedIds.length == 0 && selectedTags.length == 0) {
            scope.error = "at least 1 option must be selected.";
            return;
          }

          scope.model.collector_ids.splice(0,scope.model.collector_ids.length);
          _.forEach(selectedIds, function(c) {
            scope.model.collector_ids.push(c.id);
          });
          scope.model.collector_tags.splice(0, scope.model.collector_tags.length);
          _.forEach(selectedTags, function(t) {
            scope.model.collector_tags.push(t.text);
          });
          scope.hide();
        }

        //scope.init();
        scope.$watch('model.id', function() {
          scope.init();
        });
      },
    };
  });

});
