import * as tslib_1 from "tslib";
import _ from 'lodash';
import moment from 'moment';
import alertDef from '../../../features/alerting/state/alertDef';
import { PanelCtrl } from 'app/plugins/sdk';
import * as dateMath from 'app/core/utils/datemath';
var AlertListPanel = /** @class */ (function (_super) {
    tslib_1.__extends(AlertListPanel, _super);
    /** @ngInject */
    function AlertListPanel($scope, $injector, backendSrv) {
        var _this = _super.call(this, $scope, $injector) || this;
        _this.backendSrv = backendSrv;
        _this.showOptions = [{ text: 'Current state', value: 'current' }, { text: 'Recent state changes', value: 'changes' }];
        _this.sortOrderOptions = [
            { text: 'Alphabetical (asc)', value: 1 },
            { text: 'Alphabetical (desc)', value: 2 },
            { text: 'Importance', value: 3 },
        ];
        _this.stateFilter = {};
        _this.currentAlerts = [];
        _this.alertHistory = [];
        // Set and populate defaults
        _this.panelDefaults = {
            show: 'current',
            limit: 10,
            stateFilter: [],
            onlyAlertsOnDashboard: false,
            sortOrder: 1,
            dashboardFilter: '',
            nameFilter: '',
            folderId: null,
        };
        _.defaults(_this.panel, _this.panelDefaults);
        _this.events.on('init-edit-mode', _this.onInitEditMode.bind(_this));
        _this.events.on('refresh', _this.onRefresh.bind(_this));
        for (var key in _this.panel.stateFilter) {
            _this.stateFilter[_this.panel.stateFilter[key]] = true;
        }
        return _this;
    }
    AlertListPanel.prototype.sortResult = function (alerts) {
        if (this.panel.sortOrder === 3) {
            return _.sortBy(alerts, function (a) {
                return alertDef.alertStateSortScore[a.state];
            });
        }
        var result = _.sortBy(alerts, function (a) {
            return a.name.toLowerCase();
        });
        if (this.panel.sortOrder === 2) {
            result.reverse();
        }
        return result;
    };
    AlertListPanel.prototype.updateStateFilter = function () {
        var result = [];
        for (var key in this.stateFilter) {
            if (this.stateFilter[key]) {
                result.push(key);
            }
        }
        this.panel.stateFilter = result;
        this.onRefresh();
    };
    AlertListPanel.prototype.onRefresh = function () {
        var _this = this;
        var getAlertsPromise;
        if (this.panel.show === 'current') {
            getAlertsPromise = this.getCurrentAlertState();
        }
        if (this.panel.show === 'changes') {
            getAlertsPromise = this.getStateChanges();
        }
        getAlertsPromise.then(function () {
            _this.renderingCompleted();
        });
    };
    AlertListPanel.prototype.onFolderChange = function (folder) {
        this.panel.folderId = folder.id;
        this.refresh();
    };
    AlertListPanel.prototype.getStateChanges = function () {
        var _this = this;
        var params = {
            limit: this.panel.limit,
            type: 'alert',
            newState: this.panel.stateFilter,
        };
        if (this.panel.onlyAlertsOnDashboard) {
            params.dashboardId = this.dashboard.id;
        }
        params.from = dateMath.parse(this.dashboard.time.from).unix() * 1000;
        params.to = dateMath.parse(this.dashboard.time.to).unix() * 1000;
        return this.backendSrv.get("/api/annotations", params).then(function (res) {
            _this.alertHistory = _.map(res, function (al) {
                al.time = _this.dashboard.formatDate(al.time, 'MMM D, YYYY HH:mm:ss');
                al.stateModel = alertDef.getStateDisplayModel(al.newState);
                al.info = alertDef.getAlertAnnotationInfo(al);
                return al;
            });
            _this.noAlertsMessage = _this.alertHistory.length === 0 ? 'No alerts in current time range' : '';
            return _this.alertHistory;
        });
    };
    AlertListPanel.prototype.getCurrentAlertState = function () {
        var _this = this;
        var params = {
            state: this.panel.stateFilter,
        };
        if (this.panel.nameFilter) {
            params.query = this.panel.nameFilter;
        }
        if (this.panel.folderId >= 0) {
            params.folderId = this.panel.folderId;
        }
        if (this.panel.dashboardFilter) {
            params.dashboardQuery = this.panel.dashboardFilter;
        }
        if (this.panel.onlyAlertsOnDashboard) {
            params.dashboardId = this.dashboard.id;
        }
        if (this.panel.dashboardTags) {
            params.dashboardTag = this.panel.dashboardTags;
        }
        return this.backendSrv.get("/api/alerts", params).then(function (res) {
            _this.currentAlerts = _this.sortResult(_.map(res, function (al) {
                al.stateModel = alertDef.getStateDisplayModel(al.state);
                al.newStateDateAgo = moment(al.newStateDate)
                    .locale('en')
                    .fromNow(true);
                return al;
            }));
            if (_this.currentAlerts.length > _this.panel.limit) {
                _this.currentAlerts = _this.currentAlerts.slice(0, _this.panel.limit);
            }
            _this.noAlertsMessage = _this.currentAlerts.length === 0 ? 'No alerts' : '';
            return _this.currentAlerts;
        });
    };
    AlertListPanel.prototype.onInitEditMode = function () {
        this.addEditorTab('Options', 'public/app/plugins/panel/alertlist/editor.html');
    };
    AlertListPanel.templateUrl = 'module.html';
    AlertListPanel.scrollable = true;
    return AlertListPanel;
}(PanelCtrl));
export { AlertListPanel, AlertListPanel as PanelCtrl };
//# sourceMappingURL=module.js.map