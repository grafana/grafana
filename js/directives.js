/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana.directives', [])
.directive('kibanaPanel', function($compile) {
  return {
    restrict: 'E',
    link: function(scope, elem, attrs) {
      var template = '<img src="common/img/load.gif" class="panel-loading" ng-show="panel.loading == true"><i class="icon-edit pointer editlink" bs-modal="\'partials/paneleditor.html\'" ng-show="panel.editable != false"> <span class="small">{{panel.type}}</span></i>'+
                    '<h4>{{panel.title}}</h4>';
      elem.prepend($compile(angular.element(template))(scope));
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
        if(_.isArray(text))  
          return (text || '').join(',');
        else
          return text
      }
      ngModel.$parsers.push(split_array);
      ngModel.$formatters.push(join_array);
    }
  };
})
.directive('upload', function(timer){
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      function file_selected(evt) {
        var files = evt.target.files; // FileList object

        // files is a FileList of File objects. List some properties.
        var output = [];
        for (var i = 0, f; f = files[i]; i++) {
          var reader = new FileReader();
          reader.onload = (function(theFile) {
            return function(e) {
              // Render thumbnail.
              scope.dashboards = JSON.parse(e.target.result)
              timer.cancel_all();
              scope.$apply();
            };
          })(f);
          reader.readAsText(f);
        }
      }

      // Check for the various File API support.
      if (window.File && window.FileReader && window.FileList && window.Blob) {
        // Something
        document.getElementById('upload').addEventListener('change', file_selected, false);
      } else {
        alert('Sorry, the HTML5 File APIs are not fully supported in this browser.');
      }
    }
  }
}).directive('ngModelOnblur', function() {
  return {
    restrict: 'A',
    require: 'ngModel',
    link: function(scope, elm, attr, ngModelCtrl) {
      if (attr.type === 'radio' || attr.type === 'checkbox') return;
      
      elm.unbind('input').unbind('keydown').unbind('change');
      elm.bind('blur', function() {
        scope.$apply(function() {
          ngModelCtrl.$setViewValue(elm.val());
        });         
      });
    }
  };
});
;

