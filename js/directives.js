/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.directives', [])
.directive('kibanaPanel', function($compile) {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      var template = '<i class="icon-spinner small icon-spin icon-large panel-loading" '+
        'ng-show="panelMeta.loading == true && !panel.title"></i>'+
        ' <span class="editlink panelextra pointer" style="right:15px;top:0px" ' +
        'bs-modal="\'partials/paneleditor.html\'" ng-show="panel.editable != false">'+
        '<span class="small">{{panel.type}}</span> <i class="icon-cog pointer"></i> '+
        '</span><h4>'+
        '{{panel.title}} '+
        '<i class="icon-spinner smaller icon-spin icon-large" ng-show="panelMeta.loading == true && panel.title"></i>'+
        '</h4>';
      elem.prepend($compile(angular.element(template))(scope));
    }
  };
})
.directive('addPanel', function($compile) {
  return {
    restrict: 'A',
    link: function($scope, elem, attrs) {
      $scope.$watch('panel.type', function(n,o) {
        var _type = $scope.panel.type;
        $scope.reset_panel(_type);
        if(!_.isUndefined($scope.panel.type)) {
          var template = '<div ng-controller="'+$scope.panel.type+'">'+
            '<span ng-include src="\'partials/paneladd.html\'"></span>'+
            '</div>';
          elem.html($compile(angular.element(template))($scope));
        }
      });
    }
  };
})
.directive('arrayJoin', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, element, attr, ngModel) {

      function split_array(text) {
        return (text || '').split(',');
      }

      function join_array(text) {
        if(_.isArray(text)) {
          return (text || '').join(',');
        } else {
          return text;
        }
      }

      ngModel.$parsers.push(split_array);
      ngModel.$formatters.push(join_array);
    }
  };
})
.directive('ngModelOnblur', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, elm, attr, ngModelCtrl) {
      if (attr.type === 'radio' || attr.type === 'checkbox') {
        return;
      }

      elm.unbind('input').unbind('keydown').unbind('change');
      elm.bind('blur', function() {
        scope.$apply(function() {
          ngModelCtrl.$setViewValue(elm.val());
        });
      });
    }
  };
})
.directive('ngBlur', ['$parse', function($parse) {
  return function(scope, element, attr) {
    var fn = $parse(attr['ngBlur']);
    element.bind('blur', function(event) {
      scope.$apply(function() {
        fn(scope, {$event:event});
      });
    });
  };
}]);

