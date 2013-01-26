/*jshint globalstrict:true */
/*global angular:true */
'use strict';

angular.module('kibana-dash.directives', [])
.directive('panel', function($compile) {
  return {
    restrict: 'A',
    compile: function(element, attrs) {
      return function(scope, element, attrs) {
        scope.$watch(function () {
          return (attrs.panel && scope.index) ? true : false;
        }, function (ready) {
          if (ready) {
            $compile("<div "+attrs.panel+" params={{panel}} style='height:{{row.height}}'></div>")(scope).appendTo(element);
          }
        });
      }
    }
  }
})
.directive('upload', function(){
  return {
    restrict: 'A',
    link: function(scope, elem, attrs) {
      console.log(elem);
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
})
.directive('datepicker', function(){
  return {
    restrict: 'A',
    require: 'ngModel', 
    link: function(scope, elem, attrs) {
      elem.datepicker({
        noDefault: false, // set this to true if you don't want the current date inserted if the value-attribute is empty
        format: 'mm/dd/yyyy hh:ii:ss'
      });
    }
  };
})
.directive('date', function(dateFilter) {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {

      var dateFormat = attrs['date'] || 'yyyy-MM-dd HH:mm:ss';
      var minDate = Date.parse(attrs['min']) || 0;
      var maxDate = Date.parse(attrs['max']) || 9007199254740992;

      ctrl.$parsers.unshift(function(viewValue) {
        var parsedDateMilissec = Date.parse(viewValue);
        if (parsedDateMilissec > 0) {
          if (parsedDateMilissec >= minDate && parsedDateMilissec <= maxDate) {
              ctrl.$setValidity('date', true);
              return new Date(parsedDateMilissec);
          }
        }

        // in all other cases it is invalid, return undefined (no model update)
        ctrl.$setValidity('date', false);
        return undefined;
      });

      ctrl.$formatters.unshift(function(modelValue) {
        return dateFilter(modelValue, dateFormat);
      });
    }
  };
});

