///<reference path="../../headers/common.d.ts" />

import kbn from 'app/core/utils/kbn';
import coreModule from 'app/core/core_module';

import {WizardFlow} from 'app/core/core';

var wnd: any = window;

class DashboardImporter {

  prepareForImport(dash) {
    dash.id = null;

    var wizard = new WizardFlow('Import Dashboard');

    wizard.addStep("Importing dashboard", function() {
      return new Promise(done => {
        setTimeout(done, 2000);
      });
    });

    return wizard.start().then(() => {
      return dash;
    });
  }
}


/** @ngInject */
function uploadDashboardDirective(timer, alertSrv, $location) {
  return {
    restrict: 'A',
    link: function(scope) {
      function file_selected(evt) {
        var files = evt.target.files; // FileList object
        var readerOnload = function() {
          return function(e) {
            var dash;
            try {
              dash = JSON.parse(e.target.result);
            } catch (err) {
              console.log(err);
              scope.appEvent('alert-error', ['Import failed', 'JSON -> JS Serialization failed: ' + err.message]);
              return;
            }

            var importer = new DashboardImporter();
            importer.prepareForImport(dash).then(modified => {
              wnd.grafanaImportDashboard = modified;
              var title = kbn.slugifyForUrl(dash.title);

              scope.$apply(function() {
                $location.path('/dashboard-import/' + title);
              });
            });
          };
        };

        for (var i = 0, f; f = files[i]; i++) {
          var reader = new FileReader();
          reader.onload = readerOnload();
          reader.readAsText(f);
        }
      }
      // Check for the various File API support.
      if (wnd.File && wnd.FileReader && wnd.FileList && wnd.Blob) {
        // Something
        document.getElementById('dashupload').addEventListener('change', file_selected, false);
      } else {
        alertSrv.set('Oops','Sorry, the HTML5 File APIs are not fully supported in this browser.','error');
      }
    }
  };
}

coreModule.directive('dashUpload', uploadDashboardDirective);
