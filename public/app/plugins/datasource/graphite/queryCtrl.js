define([
  'angular',
  'lodash',
  'config',
  './gfunc',
  './parser'
],
function (angular, _, config, gfunc, Parser) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.directive('metricQueryEditorGraphite', function() {
    return {
      controller: 'GraphiteQueryCtrl',
      templateUrl: 'app/plugins/datasource/graphite/partials/query.editor.html',
    };
  });

  module.directive('metricQueryOptionsGraphite', function() {
    return {
      templateUrl: 'app/plugins/datasource/graphite/partials/query.options.html',
    };
  });

  module.controller('GraphiteQueryCtrl', function($scope, $sce, templateSrv) {

    $scope.init = function() {
      if ($scope.target) {
        $scope.target.target = $scope.target.target || '';
        parseTarget();
      }
    };

    $scope.toggleEditorMode = function() {
      $scope.target.textEditor = !$scope.target.textEditor;
      parseTarget();
    };

    // The way parsing and the target editor works needs
    // to be rewritten to handle functions that take multiple series
    function parseTarget() {
      $scope.functions = [];
      $scope.segments = [];
      delete $scope.parserError;

      if ($scope.target.textEditor) {
        return;
      }

      var parser = new Parser($scope.target.target);
      var astNode = parser.getAst();
      if (astNode === null) {
        checkOtherSegments(0);
        return;
      }

      if (astNode.type === 'error') {
        $scope.parserError = astNode.message + " at position: " + astNode.pos;
        $scope.target.textEditor = true;
        return;
      }

      try {
        parseTargeRecursive(astNode);
      }
      catch (err) {
        console.log('error parsing target:', err.message);
        $scope.parserError = err.message;
        $scope.target.textEditor = true;
      }

      checkOtherSegments($scope.segments.length - 1);
    }

    function addFunctionParameter(func, value, index, shiftBack) {
      if (shiftBack) {
        index = Math.max(index - 1, 0);
      }
      func.params[index] = value;
    }

    function parseTargeRecursive(astNode, func, index) {
      if (astNode === null) {
        return null;
      }

      switch(astNode.type) {
      case 'function':
        var innerFunc = gfunc.createFuncInstance(astNode.name, { withDefaultParams: false });

        _.each(astNode.params, function(param, index) {
          parseTargeRecursive(param, innerFunc, index);
        });

        innerFunc.updateText();
        $scope.functions.push(innerFunc);
        break;

      case 'series-ref':
        addFunctionParameter(func, astNode.value, index, $scope.segments.length > 0);
        break;
      case 'string':
      case 'number':
        if ((index-1) >= func.def.params.length) {
          throw { message: 'invalid number of parameters to method ' + func.def.name };
        }
        addFunctionParameter(func, astNode.value, index, true);
        break;
      case 'metric':
        if ($scope.segments.length > 0) {
          if (astNode.segments.length !== 1) {
            throw { message: 'Multiple metric params not supported, use text editor.' };
          }
          addFunctionParameter(func, astNode.segments[0].value, index, true);
          break;
        }

        $scope.segments = _.map(astNode.segments, function(segment) {
          return new MetricSegment(segment);
        });
      }
    }

    function getSegmentPathUpTo(index) {
      var arr = $scope.segments.slice(0, index);

      return _.reduce(arr, function(result, segment) {
        return result ? (result + "." + segment.value) : segment.value;
      }, "");
    }

    function checkOtherSegments(fromIndex) {
      if (fromIndex === 0) {
        $scope.segments.push(MetricSegment.newSelectMetric());
        return;
      }

      var path = getSegmentPathUpTo(fromIndex + 1);
      return $scope.datasource.metricFindQuery(path)
        .then(function(segments) {
          if (segments.length === 0) {
            if (path !== '') {
              $scope.segments = $scope.segments.splice(0, fromIndex);
              $scope.segments.push(MetricSegment.newSelectMetric());
            }
            return;
          }
          if (segments[0].expandable) {
            if ($scope.segments.length === fromIndex) {
              $scope.segments.push(MetricSegment.newSelectMetric());
            }
            else {
              return checkOtherSegments(fromIndex + 1);
            }
          }
        })
        .then(null, function(err) {
          $scope.parserError = err.message || 'Failed to issue metric query';
        });
    }

    function setSegmentFocus(segmentIndex) {
      _.each($scope.segments, function(segment, index) {
        segment.focus = segmentIndex === index;
      });
    }

    function wrapFunction(target, func) {
      return func.render(target);
    }

    $scope.getAltSegments = function (index) {
      var query = index === 0 ?  '*' : getSegmentPathUpTo(index) + '.*';

      return $scope.datasource.metricFindQuery(query).then(function(segments) {
          var altSegments = _.map(segments, function(segment) {
            return new MetricSegment({ value: segment.text, expandable: segment.expandable });
          });

          if (altSegments.length === 0) { return altSegments; }

          // add template variables
          _.each(templateSrv.variables, function(variable) {
            altSegments.unshift(new MetricSegment({
              type: 'template',
              value: '$' + variable.name,
              expandable: true,
            }));
          });

          // add wildcard option
          altSegments.unshift(new MetricSegment('*'));
          return altSegments;
        })
        .then(null, function(err) {
          $scope.parserError = err.message || 'Failed to issue metric query';
          return [];
        });
    };

    $scope.segmentValueChanged = function (segment, segmentIndex) {
      delete $scope.parserError;

      if ($scope.functions.length > 0 && $scope.functions[0].def.fake) {
        $scope.functions = [];
      }

      if (segment.expandable) {
        return checkOtherSegments(segmentIndex + 1)
          .then(function () {
            setSegmentFocus(segmentIndex + 1);
            $scope.targetChanged();
          });
      }
      else {
        $scope.segments = $scope.segments.splice(0, segmentIndex + 1);
      }

      setSegmentFocus(segmentIndex + 1);
      $scope.targetChanged();
    };

    $scope.targetTextChanged = function() {
      parseTarget();
      $scope.get_data();
    };

    $scope.targetChanged = function() {
      if ($scope.parserError) {
        return;
      }

      var oldTarget = $scope.target.target;

      var target = getSegmentPathUpTo($scope.segments.length);
      $scope.target.target = _.reduce($scope.functions, wrapFunction, target);

      if ($scope.target.target !== oldTarget) {
        $scope.$parent.get_data();
      }
    };

    $scope.removeFunction = function(func) {
      $scope.functions = _.without($scope.functions, func);
      $scope.targetChanged();
    };

    $scope.addFunction = function(funcDef) {
      var newFunc = gfunc.createFuncInstance(funcDef, { withDefaultParams: true });
      newFunc.added = true;
      $scope.functions.push(newFunc);

      $scope.moveAliasFuncLast();
      $scope.smartlyHandleNewAliasByNode(newFunc);

      if ($scope.segments.length === 1 && $scope.segments[0].fake) {
        $scope.segments = [];
      }

      if (!newFunc.params.length && newFunc.added) {
        $scope.targetChanged();
      }
    };

    $scope.moveAliasFuncLast = function() {
      var aliasFunc = _.find($scope.functions, function(func) {
        return func.def.name === 'alias' ||
               func.def.name === 'aliasByNode' ||
               func.def.name === 'aliasByMetric';
      });

      if (aliasFunc) {
        $scope.functions = _.without($scope.functions, aliasFunc);
        $scope.functions.push(aliasFunc);
      }
    };

    $scope.smartlyHandleNewAliasByNode = function(func) {
      if (func.def.name !== 'aliasByNode') {
        return;
      }
      for(var i = 0; i < $scope.segments.length; i++) {
        if ($scope.segments[i].value.indexOf('*') >= 0)  {
          func.params[0] = i;
          func.added = false;
          $scope.targetChanged();
          return;
        }
      }
    };

    $scope.toggleMetricOptions = function() {
      $scope.panel.metricOptionsEnabled = !$scope.panel.metricOptionsEnabled;
      if (!$scope.panel.metricOptionsEnabled) {
        delete $scope.panel.cacheTimeout;
      }
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

    function MetricSegment(options) {
      if (options === '*' || options.value === '*') {
        this.value = '*';
        this.html = $sce.trustAsHtml('<i class="fa fa-asterisk"><i>');
        this.expandable = true;
        return;
      }

      this.fake = options.fake;
      this.value = options.value;
      this.type = options.type;
      this.expandable = options.expandable;
      this.html = $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
    }

    MetricSegment.newSelectMetric = function() {
      return new MetricSegment({value: 'select metric', fake: true});
    };

    $scope.init();

  });

});
