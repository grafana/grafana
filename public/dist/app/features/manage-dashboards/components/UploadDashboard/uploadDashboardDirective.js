import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import angular from 'angular';
var template = "\n<input type=\"file\" id=\"dashupload\" name=\"dashupload\" class=\"hide\" onchange=\"angular.element(this).scope().file_selected\"/>\n<label class=\"btn btn-primary\" for=\"dashupload\">\n  <i class=\"fa fa-upload\"></i>\n  {{btnText}}\n</label>\n";
/** @ngInject */
export function uploadDashboardDirective(timer, $location) {
    return {
        restrict: 'E',
        template: template,
        scope: {
            onUpload: '&',
            btnText: '@?',
        },
        link: function (scope, elem) {
            scope.btnText = angular.isDefined(scope.btnText) ? scope.btnText : 'Upload .json File';
            function file_selected(evt) {
                var files = evt.target.files; // FileList object
                var readerOnload = function () {
                    return function (e) {
                        var dash;
                        try {
                            dash = JSON.parse(e.target.result);
                        }
                        catch (err) {
                            console.log(err);
                            appEvents.emit('alert-error', ['Import failed', 'JSON -> JS Serialization failed: ' + err.message]);
                            return;
                        }
                        scope.$apply(function () {
                            scope.onUpload({ dash: dash });
                        });
                    };
                };
                var i = 0;
                var file = files[i];
                while (file) {
                    var reader = new FileReader();
                    reader.onload = readerOnload();
                    reader.readAsText(file);
                    i += 1;
                    file = files[i];
                }
            }
            var wnd = window;
            // Check for the various File API support.
            if (wnd.File && wnd.FileReader && wnd.FileList && wnd.Blob) {
                // Something
                elem[0].addEventListener('change', file_selected, false);
            }
            else {
                appEvents.emit('alert-error', ['Oops', 'The HTML5 File APIs are not fully supported in this browser']);
            }
        },
    };
}
coreModule.directive('dashUpload', uploadDashboardDirective);
//# sourceMappingURL=uploadDashboardDirective.js.map