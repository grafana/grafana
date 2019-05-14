import * as tslib_1 from "tslib";
import _ from 'lodash';
import { QueryCtrl } from 'app/plugins/sdk';
import moment from 'moment';
var TestDataQueryCtrl = /** @class */ (function (_super) {
    tslib_1.__extends(TestDataQueryCtrl, _super);
    /** @ngInject */
    function TestDataQueryCtrl($scope, $injector, backendSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.backendSrv = backendSrv;
        _this.target.scenarioId = _this.target.scenarioId || 'random_walk';
        _this.scenarioList = [];
        _this.newPointTime = moment();
        _this.selectedPoint = { text: 'Select point', value: null };
        return _this;
    }
    TestDataQueryCtrl.prototype.getPoints = function () {
        return _.map(this.target.points, function (point, index) {
            return {
                text: moment(point[1]).format('MMMM Do YYYY, H:mm:ss') + ' : ' + point[0],
                value: index,
            };
        });
    };
    TestDataQueryCtrl.prototype.pointSelected = function (option) {
        this.selectedPoint = option;
    };
    TestDataQueryCtrl.prototype.deletePoint = function () {
        this.target.points.splice(this.selectedPoint.value, 1);
        this.selectedPoint = { text: 'Select point', value: null };
        this.refresh();
    };
    TestDataQueryCtrl.prototype.addPoint = function () {
        this.target.points = this.target.points || [];
        this.target.points.push([this.newPointValue, this.newPointTime.valueOf()]);
        this.target.points = _.sortBy(this.target.points, function (p) { return p[1]; });
        this.refresh();
    };
    TestDataQueryCtrl.prototype.$onInit = function () {
        var _this = this;
        return this.backendSrv.get('/api/tsdb/testdata/scenarios').then(function (res) {
            _this.scenarioList = res;
            _this.scenario = _.find(_this.scenarioList, { id: _this.target.scenarioId });
        });
    };
    TestDataQueryCtrl.prototype.scenarioChanged = function () {
        this.scenario = _.find(this.scenarioList, { id: this.target.scenarioId });
        this.target.stringInput = this.scenario.stringInput;
        if (this.target.scenarioId === 'manual_entry') {
            this.target.points = this.target.points || [];
        }
        else {
            delete this.target.points;
        }
        this.refresh();
    };
    TestDataQueryCtrl.templateUrl = 'partials/query.editor.html';
    return TestDataQueryCtrl;
}(QueryCtrl));
export { TestDataQueryCtrl };
//# sourceMappingURL=query_ctrl.js.map