import coreModule from 'app/core/core_module';

var template = `
<input type="file" id="dashupload" name="dashupload" class="hide"/>
<label class="btn btn-success" for="dashupload">
  <i class="fa fa-upload"></i>
  Upload .json File
</label>
`;

/** @ngInject */
function uploadDashboardDirective(timer, alertSrv, $location) {
  return {
    restrict: 'E',
    template: template,
    scope: {
      onUpload: '&',
    },
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

            scope.$apply(function() {
              scope.onUpload({ dash: dash });
            });
          };
        };

        for (var i = 0, f; (f = files[i]); i++) {
          var reader = new FileReader();
          reader.onload = readerOnload();
          reader.readAsText(f);
        }
      }

      var wnd: any = window;
      // Check for the various File API support.
      if (wnd.File && wnd.FileReader && wnd.FileList && wnd.Blob) {
        // Something
        document.getElementById('dashupload').addEventListener('change', file_selected, false);
      } else {
        alertSrv.set('Oops', 'Sorry, the HTML5 File APIs are not fully supported in this browser.', 'error');
      }
    },
  };
}

coreModule.directive('dashUpload', uploadDashboardDirective);
