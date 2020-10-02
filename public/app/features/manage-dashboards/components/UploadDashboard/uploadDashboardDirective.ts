import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import angular, { ILocationService } from 'angular';
import { AppEvents } from '@grafana/data';

const template = `
<input type="file" id="dashupload" name="dashupload" class="hide" onchange="angular.element(this).scope().file_selected"/>
<label class="btn btn-primary" for="dashupload">
  {{btnText}}
</label>
`;

/** @ngInject */
export function uploadDashboardDirective(timer: any, $location: ILocationService) {
  return {
    restrict: 'E',
    template: template,
    scope: {
      onUpload: '&',
      btnText: '@?',
    },
    link: (scope: any, elem: JQuery) => {
      scope.btnText = angular.isDefined(scope.btnText) ? scope.btnText : 'Upload .json file';

      function file_selected(evt: any) {
        const files = evt.target.files; // FileList object
        const readerOnload = () => {
          return (e: any) => {
            let dash: any;
            try {
              dash = JSON.parse(e.target.result);
            } catch (err) {
              console.error(err);
              appEvents.emit(AppEvents.alertError, [
                'Import failed',
                'JSON -> JS Serialization failed: ' + err.message,
              ]);
              return;
            }

            scope.$apply(() => {
              scope.onUpload({ dash });
            });
          };
        };

        let i = 0;
        let file = files[i];

        while (file) {
          const reader = new FileReader();
          reader.onload = readerOnload();
          reader.readAsText(file);
          i += 1;
          file = files[i];
        }
      }

      const wnd: any = window;
      // Check for the various File API support.
      if (wnd.File && wnd.FileReader && wnd.FileList && wnd.Blob) {
        // Something
        elem[0].addEventListener('change', file_selected, false);
      } else {
        appEvents.emit(AppEvents.alertError, ['Oops', 'The HTML5 File APIs are not fully supported in this browser']);
      }
    },
  };
}

coreModule.directive('dashUpload', uploadDashboardDirective);
