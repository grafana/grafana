import angular from 'angular';
import * as fileExport from 'app/core/utils/file_export';
import appEvents from 'app/core/app_events';
var ExportDataModalCtrl = /** @class */ (function () {
    function ExportDataModalCtrl() {
        this.asRows = true;
        this.dateTimeFormat = 'YYYY-MM-DDTHH:mm:ssZ';
        this.excel = false;
    }
    ExportDataModalCtrl.prototype.export = function () {
        if (this.panel === 'table') {
            fileExport.exportTableDataToCsv(this.data, this.excel);
        }
        else {
            if (this.asRows) {
                fileExport.exportSeriesListToCsv(this.data, this.dateTimeFormat, this.excel);
            }
            else {
                fileExport.exportSeriesListToCsvColumns(this.data, this.dateTimeFormat, this.excel);
            }
        }
        this.dismiss();
    };
    ExportDataModalCtrl.prototype.dismiss = function () {
        appEvents.emit('hide-modal');
    };
    return ExportDataModalCtrl;
}());
export { ExportDataModalCtrl };
export function exportDataModal() {
    return {
        restrict: 'E',
        templateUrl: 'public/app/features/dashboard/components/ExportDataModal/template.html',
        controller: ExportDataModalCtrl,
        controllerAs: 'ctrl',
        scope: {
            panel: '<',
            data: '<',
        },
        bindToController: true,
    };
}
angular.module('grafana.directives').directive('exportDataModal', exportDataModal);
//# sourceMappingURL=ExportDataModalCtrl.js.map