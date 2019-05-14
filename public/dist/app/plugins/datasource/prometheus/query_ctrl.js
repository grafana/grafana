import * as tslib_1 from "tslib";
import angular from 'angular';
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import { PromCompleter } from './completer';
import './mode-prometheus';
import './snippets/prometheus';
var PrometheusQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(PrometheusQueryCtrl, _super);
    /** @ngInject */
    function PrometheusQueryCtrl($scope, $injector, templateSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.templateSrv = templateSrv;
        var target = _this.target;
        target.expr = target.expr || '';
        target.intervalFactor = target.intervalFactor || 1;
        target.format = target.format || _this.getDefaultFormat();
        _this.metric = '';
        _this.resolutions = _.map([1, 2, 3, 4, 5, 10], function (f) {
            return { factor: f, label: '1/' + f };
        });
        _this.formats = [
            { text: 'Time series', value: 'time_series' },
            { text: 'Table', value: 'table' },
            { text: 'Heatmap', value: 'heatmap' },
        ];
        _this.instant = false;
        _this.updateLink();
        return _this;
    }
    PrometheusQueryCtrl.prototype.getCompleter = function (query) {
        return new PromCompleter(this.datasource, this.templateSrv);
    };
    PrometheusQueryCtrl.prototype.getDefaultFormat = function () {
        if (this.panelCtrl.panel.type === 'table') {
            return 'table';
        }
        else if (this.panelCtrl.panel.type === 'heatmap') {
            return 'heatmap';
        }
        return 'time_series';
    };
    PrometheusQueryCtrl.prototype.refreshMetricData = function () {
        if (!_.isEqual(this.oldTarget, this.target)) {
            this.oldTarget = angular.copy(this.target);
            this.panelCtrl.refresh();
            this.updateLink();
        }
    };
    PrometheusQueryCtrl.prototype.updateLink = function () {
        var range = this.panelCtrl.range;
        if (!range) {
            return;
        }
        var rangeDiff = Math.ceil((range.to.valueOf() - range.from.valueOf()) / 1000);
        var endTime = range.to.utc().format('YYYY-MM-DD HH:mm');
        var expr = {
            'g0.expr': this.templateSrv.replace(this.target.expr, this.panelCtrl.panel.scopedVars, this.datasource.interpolateQueryExpr),
            'g0.range_input': rangeDiff + 's',
            'g0.end_input': endTime,
            'g0.step_input': this.target.step,
            'g0.stacked': this.panelCtrl.panel.stack ? 1 : 0,
            'g0.tab': 0,
        };
        var args = _.map(expr, function (v, k) {
            return k + '=' + encodeURIComponent(v);
        }).join('&');
        this.linkToPrometheus = this.datasource.directUrl + '/graph?' + args;
    };
    PrometheusQueryCtrl.prototype.getCollapsedText = function () {
        return this.target.expr;
    };
    PrometheusQueryCtrl.templateUrl = 'partials/query.editor.html';
    return PrometheusQueryCtrl;
}(QueryCtrl));
export { PrometheusQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map