define([
  '../core_module',
  'lodash',
],
function (coreModule, _) {
  'use strict';

  coreModule.default.directive('hostUpload', function(alertSrv) {
    return {
      restrict: 'A',
      link: function(scope) {
        function file_selected(evt) {
          var files = evt.target.files; // FileList object
          var readerOnload = function() {
            return function(e) {
              scope.$apply(function() {
                var param = JSON.parse(e.target.result);
                window.cmdbHosts = _.cloneDeep(param);
              });
            };
          };
          for (var i = 0, f; f = files[i]; i++) {
            var reader = new FileReader();
            reader.onload = (readerOnload)(f);
            reader.readAsText(f);
          }
        }
        // Check for the various File API support.
        if (window.File && window.FileReader && window.FileList && window.Blob) {
          // Something
          document.getElementById('hostupload').addEventListener('change', file_selected, false);
        } else {
          alertSrv.set('非常抱歉','上传失败, 您的浏览器版本过低,请换最新的谷歌浏览器/火狐浏览器','error');
        }
      }
    };
  });
});