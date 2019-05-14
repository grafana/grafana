import * as tslib_1 from "tslib";
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
var defaultQuery = "SELECT\n  $__timeEpoch(<time_column>),\n  <value column> as value,\n  <series name column> as metric\nFROM\n  <table name>\nWHERE\n  $__timeFilter(time_column)\nORDER BY\n  <time_column> ASC";
var MssqlQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(MssqlQueryCtrl, _super);
    /** @ngInject */
    function MssqlQueryCtrl($scope, $injector) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.target.format = _this.target.format || 'time_series';
        _this.target.alias = '';
        _this.formats = [{ text: 'Time series', value: 'time_series' }, { text: 'Table', value: 'table' }];
        if (!_this.target.rawSql) {
            // special handling when in table panel
            if (_this.panelCtrl.panel.type === 'table') {
                _this.target.format = 'table';
                _this.target.rawSql = 'SELECT 1';
            }
            else {
                _this.target.rawSql = defaultQuery;
            }
        }
        _this.panelCtrl.events.on('data-received', _this.onDataReceived.bind(_this), $scope);
        _this.panelCtrl.events.on('data-error', _this.onDataError.bind(_this), $scope);
        return _this;
    }
    MssqlQueryCtrl.prototype.onDataReceived = function (dataList) {
        this.lastQueryMeta = null;
        this.lastQueryError = null;
        var anySeriesFromQuery = _.find(dataList, { refId: this.target.refId });
        if (anySeriesFromQuery) {
            this.lastQueryMeta = anySeriesFromQuery.meta;
        }
    };
    MssqlQueryCtrl.prototype.onDataError = function (err) {
        if (err.data && err.data.results) {
            var queryRes = err.data.results[this.target.refId];
            if (queryRes) {
                this.lastQueryMeta = queryRes.meta;
                this.lastQueryError = queryRes.error;
            }
        }
    };
    MssqlQueryCtrl.templateUrl = 'partials/query.editor.html';
    return MssqlQueryCtrl;
}(QueryCtrl));
export { MssqlQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map