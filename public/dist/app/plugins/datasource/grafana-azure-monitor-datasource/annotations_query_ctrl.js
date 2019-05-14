var AzureMonitorAnnotationsQueryCtrl = /** @class */ (function () {
    /** @ngInject */
    function AzureMonitorAnnotationsQueryCtrl() {
        this.defaultQuery = '<your table>\n| where $__timeFilter() \n| project TimeGenerated, Text=YourTitleColumn, Tags="tag1,tag2"';
        this.annotation.queryType = this.annotation.queryType || 'Azure Log Analytics';
        this.annotation.rawQuery = this.annotation.rawQuery || this.defaultQuery;
        this.getWorkspaces();
    }
    AzureMonitorAnnotationsQueryCtrl.prototype.getWorkspaces = function () {
        var _this = this;
        if (this.workspaces && this.workspaces.length > 0) {
            return this.workspaces;
        }
        return this.datasource
            .getAzureLogAnalyticsWorkspaces()
            .then(function (list) {
            _this.workspaces = list;
            if (list.length > 0 && !_this.annotation.workspace) {
                _this.annotation.workspace = list[0].value;
            }
            return _this.workspaces;
        })
            .catch(function () { });
    };
    AzureMonitorAnnotationsQueryCtrl.templateUrl = 'partials/annotations.editor.html';
    return AzureMonitorAnnotationsQueryCtrl;
}());
export { AzureMonitorAnnotationsQueryCtrl };
//# sourceMappingURL=annotations_query_ctrl.js.map